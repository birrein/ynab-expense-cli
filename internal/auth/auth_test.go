package auth

import (
	"context"
	"errors"
	"reflect"
	"strings"
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

	resolver := Resolver{Store: fakeStore{err: ErrTokenNotFound}}

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

func TestResolverPreservesNonMissingKeychainError(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "")
	keychainErr := errors.New("keychain denied")

	resolver := Resolver{Store: fakeStore{err: keychainErr}}

	token, source, err := resolver.Token(context.Background())
	if !errors.Is(err, keychainErr) {
		t.Fatalf("Token err = %v, want error preserving %v", err, keychainErr)
	}
	if errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("Token err = %v, must not be %v", err, ErrTokenNotFound)
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
	runner := func(_ context.Context, name string, input string, args ...string) ([]byte, error) {
		calls = append(calls, securityCall{name: name, input: input, args: append([]string(nil), args...)})
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
			name:  "/usr/bin/security",
			input: "secret-token\n",
			args:  []string{"add-generic-password", "-U", "-a", "tester", "-s", "ynab-expense", "-w"},
		},
	}
	if !reflect.DeepEqual(calls, want) {
		t.Fatalf("security calls = %#v, want %#v", calls, want)
	}
}

func TestKeychainStoreSetDoesNotPassTokenInProcessArgs(t *testing.T) {
	var input string
	var args []string
	runner := func(_ context.Context, _ string, gotInput string, gotArgs ...string) ([]byte, error) {
		input = gotInput
		args = append([]string(nil), gotArgs...)
		return nil, nil
	}
	store := KeychainStore{Account: "tester", Service: "ynab-expense", Run: runner}

	if err := store.Set(context.Background(), "secret-token"); err != nil {
		t.Fatalf("Set returned error: %v", err)
	}
	if !strings.Contains(input, "secret-token") {
		t.Fatalf("Set input = %q, want token in stdin input", input)
	}
	for _, arg := range args {
		if arg == "secret-token" {
			t.Fatalf("Set args contain token: %#v", args)
		}
	}
	if args[len(args)-1] != "-w" {
		t.Fatalf("Set last arg = %q, want -w", args[len(args)-1])
	}
}

func TestKeychainStoreRefusesEmptyAccount(t *testing.T) {
	called := false
	runner := func(context.Context, string, string, ...string) ([]byte, error) {
		called = true
		return nil, nil
	}
	store := KeychainStore{Account: "", Service: "ynab-expense", Run: runner}

	_, err := store.Get(context.Background())
	if err == nil {
		t.Fatal("Get returned nil error, want empty account error")
	}
	if called {
		t.Fatal("Get invoked security command with empty account")
	}
}

func TestKeychainStoreRefusesWhitespaceAccount(t *testing.T) {
	called := false
	runner := func(context.Context, string, string, ...string) ([]byte, error) {
		called = true
		return nil, nil
	}
	store := KeychainStore{Account: " \t\n ", Service: "ynab-expense", Run: runner}

	if err := store.Set(context.Background(), "secret-token"); err == nil {
		t.Fatal("Set returned nil error, want whitespace account error")
	}
	if called {
		t.Fatal("Set invoked security command with whitespace account")
	}
}

func TestDefaultRunnerWritesInputThroughPTY(t *testing.T) {
	runner := NewKeychainStore().Run

	output, err := runner(
		context.Background(),
		"/bin/sh",
		"x\n",
		"-c",
		"stty -echo; IFS= read -r value < /dev/tty; [ \"$value\" = x ] && printf ok",
	)
	if err != nil {
		t.Fatalf("runner returned error: %v; output: %q", err, output)
	}
	if !strings.Contains(string(output), "ok") {
		t.Fatalf("runner output = %q, want it to contain ok", output)
	}
}

type securityCall struct {
	name  string
	input string
	args  []string
}
