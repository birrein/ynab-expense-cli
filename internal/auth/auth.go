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

	_, err := s.runner()(ctx, "/usr/bin/security", token+"\n", "add-generic-password", "-U", "-a", s.Account, "-s", s.service(), "-w")
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
	readDone := make(chan struct{})
	go func() {
		_, _ = io.Copy(&output, ptmx)
		close(readDone)
	}()

	_, writeErr := io.WriteString(ptmx, input)
	waitErr := cmd.Wait()
	_ = ptmx.Close()
	<-readDone

	if waitErr != nil {
		return output.Bytes(), waitErr
	}
	if writeErr != nil {
		return output.Bytes(), writeErr
	}
	return output.Bytes(), nil
}
