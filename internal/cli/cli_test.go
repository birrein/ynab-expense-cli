package cli

import (
	"bytes"
	"context"
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

func TestAuthSetTokenStoresArgumentWithoutPrintingToken(t *testing.T) {
	var out bytes.Buffer
	store := &fakeTokenStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{tokenStore: store})

	err := executeCommand(cmd, "auth", "set-token", "secret-token")

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
	accountsBudget       string
	accountsResponse     []byte
	categoriesResponse   []byte
	transactionsResponse []byte
	err                  error
}

func (c *fakeYNABClient) GetPlans(context.Context) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.plansResponse, nil
}

func (c *fakeYNABClient) GetAccounts(_ context.Context, budget string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.accountsBudget = budget
	return c.accountsResponse, nil
}

func (c *fakeYNABClient) GetCategories(context.Context, string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.categoriesResponse, nil
}

func (c *fakeYNABClient) GetTransactions(context.Context, string, string, string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.transactionsResponse, nil
}
