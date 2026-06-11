package auth

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
)

const SourceEnv = "env:YNAB_API_TOKEN"
const SourceKeychain = "macOS Keychain"
const SourceNone = "not configured"
const DefaultService = "ynab-expense"

var ErrTokenNotFound = errors.New("YNAB token not found")

type TokenStore interface {
	Get(context.Context) (string, error)
	Set(context.Context, string) error
}

type Resolver struct {
	Store TokenStore
}

func (r Resolver) Token(ctx context.Context) (token string, source string, err error) {
	if token := strings.TrimSpace(os.Getenv("YNAB_API_TOKEN")); token != "" {
		return token, SourceEnv, nil
	}

	if r.Store == nil {
		return "", SourceNone, ErrTokenNotFound
	}

	token, err = r.Store.Get(ctx)
	if err != nil {
		if errors.Is(err, ErrTokenNotFound) {
			return "", SourceNone, ErrTokenNotFound
		}
		return "", SourceNone, err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return "", SourceNone, ErrTokenNotFound
	}

	return token, SourceKeychain, nil
}

type Runner func(ctx context.Context, name string, input string, args ...string) ([]byte, error)

type KeychainStore struct {
	Account string
	Service string
	Run     Runner
}

func NewKeychainStore() KeychainStore {
	account := ""
	if current, err := user.Current(); err == nil {
		account = current.Username
	} else {
		account = os.Getenv("USER")
	}

	return KeychainStore{
		Account: account,
		Service: DefaultService,
		Run:     runCommand,
	}
}

func (s KeychainStore) Get(ctx context.Context) (string, error) {
	if err := s.validate(); err != nil {
		return "", err
	}

	output, err := s.runner()(ctx, "/usr/bin/security", "", "find-generic-password", "-a", s.Account, "-s", s.service(), "-w")
	if err != nil {
		if isMissingKeychainItem(output) {
			return "", ErrTokenNotFound
		}
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func (s KeychainStore) Set(ctx context.Context, token string) error {
	if err := s.validate(); err != nil {
		return err
	}

	_, err := s.runner()(ctx, "/usr/bin/security", token+"\n"+token+"\n", "add-generic-password", "-U", "-a", s.Account, "-s", s.service(), "-w")
	return err
}

func (s KeychainStore) runner() Runner {
	if s.Run != nil {
		return s.Run
	}
	return NewKeychainStore().Run
}

func (s KeychainStore) service() string {
	if s.Service != "" {
		return s.Service
	}
	return DefaultService
}

func (s KeychainStore) validate() error {
	if strings.TrimSpace(s.Account) == "" {
		return fmt.Errorf("keychain account is required")
	}
	return nil
}

func runCommand(ctx context.Context, name string, input string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	if input == "" {
		return cmd.CombinedOutput()
	}
	return runCommandWithPTY(cmd, input)
}

func isMissingKeychainItem(output []byte) bool {
	return strings.Contains(strings.ToLower(string(output)), "specified item could not be found in the keychain")
}

func runCommandWithPTY(cmd *exec.Cmd, input string) ([]byte, error) {
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	var output bytes.Buffer
	var outputMu sync.Mutex
	outputChanged := make(chan struct{}, 1)
	readDone := make(chan struct{})
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				outputMu.Lock()
				_, _ = output.Write(buf[:n])
				outputMu.Unlock()
				select {
				case outputChanged <- struct{}{}:
				default:
				}
			}
			if err != nil {
				break
			}
		}
		close(readDone)
	}()

	writeErr := writeInputChunks(ptmx, input, func() int {
		outputMu.Lock()
		defer outputMu.Unlock()
		return output.Len()
	}, outputChanged)
	waitErr := cmd.Wait()
	_ = ptmx.Close()
	<-readDone

	outputMu.Lock()
	outputBytes := output.Bytes()
	outputMu.Unlock()

	if waitErr != nil {
		return outputBytes, waitErr
	}
	if writeErr != nil {
		return outputBytes, writeErr
	}
	return outputBytes, nil
}

func writeInputChunks(w io.Writer, input string, outputLen func() int, outputChanged <-chan struct{}) error {
	chunks := strings.SplitAfter(input, "\n")
	if len(chunks) > 0 && chunks[len(chunks)-1] == "" {
		chunks = chunks[:len(chunks)-1]
	}
	if len(chunks) > 1 {
		waitForPTYOutput(0, outputLen, outputChanged)
	}

	for index, chunk := range chunks {
		if index > 0 {
			waitForPTYOutput(outputLen(), outputLen, outputChanged)
			time.Sleep(50 * time.Millisecond)
		}
		if _, err := io.WriteString(w, strings.ReplaceAll(chunk, "\n", "\r")); err != nil {
			return err
		}
	}
	return nil
}

func waitForPTYOutput(previousLen int, outputLen func() int, outputChanged <-chan struct{}) {
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()

	for outputLen() <= previousLen {
		select {
		case <-outputChanged:
		case <-timer.C:
			return
		}
	}
}
