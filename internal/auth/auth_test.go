package auth

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

type fakeStore struct {
	token string
	err   error
}

func (s fakeStore) Get(context.Context) (string, error) {
	return s.token, s.err
}

func (s fakeStore) Set(context.Context, string) error {
	return nil
}

func TestResolverPrefersEnvironmentToken(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "from-env")

	resolver := Resolver{Store: fakeStore{token: "from-keychain"}}

	token, source, err := resolver.Token(context.Background())
	if err != nil {
		t.Fatalf("Token returned error: %v", err)
	}
	if token != "from-env" {
		t.Fatalf("Token token = %q, want %q", token, "from-env")
	}
	if source != SourceEnv {
		t.Fatalf("Token source = %q, want %q", source, SourceEnv)
	}
}

func TestResolverTrimsEnvironmentToken(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "  from-env  ")

	resolver := Resolver{Store: fakeStore{token: "from-keychain"}}

	token, source, err := resolver.Token(context.Background())
	if err != nil {
		t.Fatalf("Token returned error: %v", err)
	}
	if token != "from-env" {
		t.Fatalf("Token token = %q, want %q", token, "from-env")
	}
	if source != SourceEnv {
		t.Fatalf("Token source = %q, want %q", source, SourceEnv)
	}
}

func TestResolverFallsBackToKeychain(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "")

	resolver := Resolver{Store: fakeStore{token: "from-keychain"}}

	token, source, err := resolver.Token(context.Background())
	if err != nil {
		t.Fatalf("Token returned error: %v", err)
	}
	if token != "from-keychain" {
		t.Fatalf("Token token = %q, want %q", token, "from-keychain")
	}
	if source != SourceKeychain {
		t.Fatalf("Token source = %q, want %q", source, SourceKeychain)
	}
}

func TestResolverReturnsNotFoundWithNilStore(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "")

	resolver := Resolver{}

	token, source, err := resolver.Token(context.Background())
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("Token err = %v, want %v", err, ErrTokenNotFound)
	}
	if token != "" {
		t.Fatalf("Token token = %q, want empty", token)
	}
	if source != SourceNone {
		t.Fatalf("Token source = %q, want %q", source, SourceNone)
	}
}

func TestResolverReturnsNotFoundWhenKeychainMissing(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", " ")

	resolver := Resolver{Store: fakeStore{err: errors.New("missing")}}

	token, source, err := resolver.Token(context.Background())
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("Token err = %v, want %v", err, ErrTokenNotFound)
	}
	if token != "" {
		t.Fatalf("Token token = %q, want empty", token)
	}
	if source != SourceNone {
		t.Fatalf("Token source = %q, want %q", source, SourceNone)
	}
}

func TestResolverReturnsNotFoundWhenKeychainTokenEmpty(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "")

	resolver := Resolver{Store: fakeStore{token: "  \n\t  "}}

	token, source, err := resolver.Token(context.Background())
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("Token err = %v, want %v", err, ErrTokenNotFound)
	}
	if token != "" {
		t.Fatalf("Token token = %q, want empty", token)
	}
	if source != SourceNone {
		t.Fatalf("Token source = %q, want %q", source, SourceNone)
	}
}

func TestKeychainStoreBuildsSecurityCommands(t *testing.T) {
	var calls []securityCall
	runner := func(_ context.Context, name string, args ...string) ([]byte, error) {
		calls = append(calls, securityCall{name: name, args: append([]string(nil), args...)})
		if len(args) > 0 && args[0] == "find-generic-password" {
			return []byte(" secret-token\n"), nil
		}
		return nil, nil
	}
	store := KeychainStore{Account: "tester", Service: "ynab-expense", Run: runner}

	token, err := store.Get(context.Background())
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if token != "secret-token" {
		t.Fatalf("Get token = %q, want %q", token, "secret-token")
	}

	if err := store.Set(context.Background(), "secret-token"); err != nil {
		t.Fatalf("Set returned error: %v", err)
	}

	want := []securityCall{
		{
			name: "/usr/bin/security",
			args: []string{"find-generic-password", "-a", "tester", "-s", "ynab-expense", "-w"},
		},
		{
			name: "/usr/bin/security",
			args: []string{"add-generic-password", "-U", "-a", "tester", "-s", "ynab-expense", "-w", "secret-token"},
		},
	}
	if !reflect.DeepEqual(calls, want) {
		t.Fatalf("security calls = %#v, want %#v", calls, want)
	}
}

type securityCall struct {
	name string
	args []string
}
