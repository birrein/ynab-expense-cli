package auth

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"os/user"
	"strings"
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
		return "", SourceNone, ErrTokenNotFound
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return "", SourceNone, ErrTokenNotFound
	}

	return token, SourceKeychain, nil
}

type Runner func(ctx context.Context, name string, args ...string) ([]byte, error)

type KeychainStore struct {
	Account string
	Service string
	Run     Runner
}

func NewKeychainStore() KeychainStore {
	account := ""
	if current, err := user.Current(); err == nil {
		account = current.Username
	}

	return KeychainStore{
		Account: account,
		Service: DefaultService,
		Run: func(ctx context.Context, name string, args ...string) ([]byte, error) {
			return exec.CommandContext(ctx, name, args...).Output()
		},
	}
}

func (s KeychainStore) Get(ctx context.Context) (string, error) {
	output, err := s.runner()(ctx, "/usr/bin/security", "find-generic-password", "-a", s.Account, "-s", s.service(), "-w")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func (s KeychainStore) Set(ctx context.Context, token string) error {
	_, err := s.runner()(ctx, "/usr/bin/security", "add-generic-password", "-U", "-a", s.Account, "-s", s.service(), "-w", token)
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
