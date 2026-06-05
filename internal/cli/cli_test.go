package cli

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/birrein/ynab-expense-cli/internal/auth"
	"github.com/spf13/cobra"
)

func TestAuthStatusDoesNotPrintToken(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: fakeTokenResolver{
			token:  "secret-token",
			source: auth.SourceEnv,
		},
	})

	err := executeCommand(cmd, "auth", "status")

	if err != nil {
		t.Fatalf("auth status returned error: %v", err)
	}
	output := out.String()
	if strings.Contains(output, "secret-token") {
		t.Fatalf("auth status printed token: %q", output)
	}
	if !strings.Contains(output, "configured") || !strings.Contains(output, auth.SourceEnv) {
		t.Fatalf("auth status output should include configured source, got %q", output)
	}
}

func TestBudgetsRequiresTokenWhenNoToken(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: fakeTokenResolver{err: auth.ErrTokenNotFound},
	})

	err := executeCommand(cmd, "budgets")

	if err == nil {
		t.Fatal("budgets returned nil error")
	}
	if !strings.Contains(err.Error(), "No YNAB token found") {
		t.Fatalf("expected missing-token error, got %q", err.Error())
	}
}

func TestAccountsListsResponseWithoutLiveAPI(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		accountsResponse: []byte(`{"data":{"accounts":[{"name":"Checking"}]}}`),
	}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			if token != "secret-token" {
				t.Fatalf("client factory received token %q", token)
			}
			return client
		},
	})

	err := executeCommand(cmd, "accounts", "--budget", "default")

	if err != nil {
		t.Fatalf("accounts returned error: %v", err)
	}
	if client.accountsBudget != "default" {
		t.Fatalf("expected budget default, got %q", client.accountsBudget)
	}
	output := out.String()
	if !strings.Contains(output, `"Checking"`) {
		t.Fatalf("accounts output did not include response JSON, got %q", output)
	}
}

func TestAuthSetTokenRejectsPositionalToken(t *testing.T) {
	var out bytes.Buffer
	store := &fakeTokenStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{tokenStore: store})

	err := executeCommand(cmd, "auth", "set-token", "secret-token")

	if err == nil {
		t.Fatal("auth set-token accepted a positional token")
	}
	if store.token != "" {
		t.Fatalf("positional token should not be stored, got %q", store.token)
	}
	output := out.String()
	if strings.Contains(output, "secret-token") {
		t.Fatalf("auth set-token printed positional token: %q", output)
	}
}

func TestAuthSetTokenPromptStoresTokenWithoutPrintingToken(t *testing.T) {
	var out bytes.Buffer
	store := &fakeTokenStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenStore: store,
		promptToken: func() (string, error) {
			return "secret-token", nil
		},
	})

	err := executeCommand(cmd, "auth", "set-token")

	if err != nil {
		t.Fatalf("auth set-token returned error: %v", err)
	}
	if store.token != "secret-token" {
		t.Fatalf("expected stored token secret-token, got %q", store.token)
	}
	output := out.String()
	if strings.Contains(output, "secret-token") {
		t.Fatalf("auth set-token printed token: %q", output)
	}
	if !strings.Contains(strings.ToLower(output), "saved") {
		t.Fatalf("auth set-token output should say saved, got %q", output)
	}
}

func TestAuthSetTokenEmptyPromptFails(t *testing.T) {
	var out bytes.Buffer
	store := &fakeTokenStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenStore: store,
		promptToken: func() (string, error) {
			return "  \n", nil
		},
	})

	err := executeCommand(cmd, "auth", "set-token")

	if err == nil {
		t.Fatal("auth set-token accepted an empty prompted token")
	}
	if !strings.Contains(err.Error(), "token is required") {
		t.Fatalf("expected token required error, got %q", err.Error())
	}
	if store.token != "" {
		t.Fatalf("empty token should not be stored, got %q", store.token)
	}
}

func TestAuthSetTokenPromptErrorIsClear(t *testing.T) {
	var out bytes.Buffer
	store := &fakeTokenStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenStore: store,
		promptToken: func() (string, error) {
			return "", errors.New("not a terminal")
		},
	})

	err := executeCommand(cmd, "auth", "set-token")

	if err == nil {
		t.Fatal("auth set-token ignored prompt error")
	}
	if !strings.Contains(err.Error(), "read token from terminal") {
		t.Fatalf("expected clear terminal read error, got %q", err.Error())
	}
	if store.token != "" {
		t.Fatalf("failed prompt should not store token, got %q", store.token)
	}
}

func TestAuthSetTokenStdinStoresTokenWithoutPrintingToken(t *testing.T) {
	var out bytes.Buffer
	store := &fakeTokenStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenStore: store,
		stdin:      strings.NewReader("secret-token\n"),
	})

	err := executeCommand(cmd, "auth", "set-token", "--token-stdin")

	if err != nil {
		t.Fatalf("auth set-token --token-stdin returned error: %v", err)
	}
	if store.token != "secret-token" {
		t.Fatalf("expected stored token secret-token, got %q", store.token)
	}
	output := out.String()
	if strings.Contains(output, "secret-token") {
		t.Fatalf("auth set-token --token-stdin printed token: %q", output)
	}
	if !strings.Contains(strings.ToLower(output), "saved") {
		t.Fatalf("auth set-token output should say saved, got %q", output)
	}
}

func TestBudgetsListsResponseWithoutLiveAPI(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		plansResponse: []byte(`{"data":{"plans":[{"name":"Main Budget"}]}}`),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd, "budgets")

	if err != nil {
		t.Fatalf("budgets returned error: %v", err)
	}
	if !client.plansCalled {
		t.Fatal("budgets did not call GetPlans")
	}
	if !strings.Contains(out.String(), `"Main Budget"`) {
		t.Fatalf("budgets output did not include response JSON, got %q", out.String())
	}
}

func TestCategoriesForwardsBudgetAndWritesResponse(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		categoriesResponse: []byte(`{"data":{"categories":[{"name":"Food"}]}}`),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd, "categories", "--budget", "groceries")

	if err != nil {
		t.Fatalf("categories returned error: %v", err)
	}
	if client.categoriesBudget != "groceries" {
		t.Fatalf("expected budget groceries, got %q", client.categoriesBudget)
	}
	if !strings.Contains(out.String(), `"Food"`) {
		t.Fatalf("categories output did not include response JSON, got %q", out.String())
	}
}

func TestTransactionsForwardsFiltersAndWritesResponse(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		transactionsResponse: []byte(`{"data":{"transactions":[{"memo":"Lunch"}]}}`),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd, "transactions", "--budget", "default", "--since", "2026-06-01", "--until", "2026-06-05")

	if err != nil {
		t.Fatalf("transactions returned error: %v", err)
	}
	if client.transactionsBudget != "default" {
		t.Fatalf("expected budget default, got %q", client.transactionsBudget)
	}
	if client.transactionsSince != "2026-06-01" {
		t.Fatalf("expected since 2026-06-01, got %q", client.transactionsSince)
	}
	if client.transactionsUntil != "2026-06-05" {
		t.Fatalf("expected until 2026-06-05, got %q", client.transactionsUntil)
	}
	if !strings.Contains(out.String(), `"Lunch"`) {
		t.Fatalf("transactions output did not include response JSON, got %q", out.String())
	}
}

func commandWithFakeClient(out io.Writer, client ynabClient) *cobra.Command {
	return newRootCommandWithDeps(out, out, cliDeps{
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			return client
		},
	})
}

func executeCommand(cmd *cobra.Command, args ...string) error {
	cmd.SetArgs(args)
	return cmd.Execute()
}

type fakeTokenResolver struct {
	token  string
	source string
	err    error
}

func (r fakeTokenResolver) Token(context.Context) (string, string, error) {
	if r.err != nil {
		return "", auth.SourceNone, r.err
	}
	return r.token, r.source, nil
}

type fakeTokenStore struct {
	token string
	err   error
}

func (s *fakeTokenStore) Set(_ context.Context, token string) error {
	if s.err != nil {
		return s.err
	}
	s.token = token
	return nil
}

type fakeYNABClient struct {
	plansResponse        []byte
	plansCalled          bool
	accountsBudget       string
	accountsResponse     []byte
	categoriesBudget     string
	categoriesResponse   []byte
	transactionsBudget   string
	transactionsSince    string
	transactionsUntil    string
	transactionsResponse []byte
	err                  error
}

func (c *fakeYNABClient) GetPlans(context.Context) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.plansCalled = true
	return c.plansResponse, nil
}

func (c *fakeYNABClient) GetAccounts(_ context.Context, budget string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.accountsBudget = budget
	return c.accountsResponse, nil
}

func (c *fakeYNABClient) GetCategories(_ context.Context, budget string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.categoriesBudget = budget
	return c.categoriesResponse, nil
}

func (c *fakeYNABClient) GetTransactions(_ context.Context, budget string, since string, until string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.transactionsBudget = budget
	c.transactionsSince = since
	c.transactionsUntil = until
	return c.transactionsResponse, nil
}
