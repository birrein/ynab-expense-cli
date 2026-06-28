package cli

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/birrein/ynab-expense-cli/internal/auth"
	localconfig "github.com/birrein/ynab-expense-cli/internal/config"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
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
	if strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("auth set-token error included positional token: %q", err.Error())
	}
	if !strings.Contains(err.Error(), "auth set-token does not accept token arguments") {
		t.Fatalf("expected sanitized positional token error, got %q", err.Error())
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

func TestAddDryRunDoesNotRequireToken(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd,
		"add",
		"--budget", "default",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--currency", "CLP",
		"--payee", "Comercio",
		"--date", "2026-06-05",
		"--dry-run",
	)

	if err != nil {
		t.Fatalf("add dry-run returned error: %v", err)
	}
	output := out.String()
	for _, want := range []string{
		`"dry_run": true`,
		`"amount": -12990000`,
		`"source=ynab-expense-cli"`,
		`"cleared": "uncleared"`,
		`"approved": false`,
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("add dry-run output missing %s, got %q", want, output)
		}
	}
}

func TestAddRejectsDryRunAndCommitTogether(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd,
		"add",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "2026-06-05",
		"--dry-run",
		"--commit",
	)

	if err == nil {
		t.Fatal("add accepted --dry-run with --commit")
	}
	if !strings.Contains(err.Error(), "--dry-run cannot be used with --commit") {
		t.Fatalf("expected dry-run/commit conflict error, got %q", err.Error())
	}
}

func TestAddCommitRequiresToken(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: fakeTokenResolver{err: auth.ErrTokenNotFound},
	})

	err := executeCommand(cmd,
		"add",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "2026-06-05",
		"--commit",
	)

	if err == nil {
		t.Fatal("add --commit returned nil error without token")
	}
	if !strings.Contains(err.Error(), "No YNAB token found") {
		t.Fatalf("expected missing-token error, got %q", err.Error())
	}
}

func TestAddCommitSendsTransaction(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		createTransactionResponse: []byte(`{"data":{"transaction":{"id":"txn-123"}}}`),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd,
		"add",
		"--budget", " default ",
		"--account-id", " account-123 ",
		"--amount", "12.990",
		"--currency", "CLP",
		"--payee", " Comercio ",
		"--date", " 2026-06-05 ",
		"--category-id", "category-123",
		"--memo", "almuerzo",
		"--commit",
	)

	if err != nil {
		t.Fatalf("add --commit returned error: %v", err)
	}
	if client.createTransactionBudget != "default" {
		t.Fatalf("expected budget default, got %q", client.createTransactionBudget)
	}
	transaction := client.createTransactionPayload.Transaction
	if transaction.AccountID != "account-123" {
		t.Fatalf("expected account account-123, got %q", transaction.AccountID)
	}
	if transaction.PayeeName != "Comercio" {
		t.Fatalf("expected payee Comercio, got %q", transaction.PayeeName)
	}
	if transaction.Date != "2026-06-05" {
		t.Fatalf("expected date 2026-06-05, got %q", transaction.Date)
	}
	if transaction.Amount != -12990000 {
		t.Fatalf("expected amount -12990000, got %d", transaction.Amount)
	}
	if transaction.ImportID == "" {
		t.Fatal("expected import_id to be set")
	}
	if transaction.Memo != "almuerzo; source=ynab-expense-cli" {
		t.Fatalf("expected audit memo, got %q", transaction.Memo)
	}
	if transaction.CategoryID == nil || *transaction.CategoryID != "category-123" {
		t.Fatalf("expected category category-123, got %#v", transaction.CategoryID)
	}
	if !strings.Contains(out.String(), `"txn-123"`) {
		t.Fatalf("add --commit output did not include response JSON, got %q", out.String())
	}
}

func TestAddCommitRejectsBlankAccountIDBeforeTokenResolution(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd,
		"add",
		"--account-id", "   ",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "2026-06-05",
		"--commit",
	)

	if err == nil {
		t.Fatal("add --commit accepted blank account-id")
	}
	if !strings.Contains(err.Error(), "--account-id is required") {
		t.Fatalf("expected account-id required error, got %q", err.Error())
	}
}

func TestAddCommitRejectsBlankPayeeBeforeTokenResolution(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd,
		"add",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "   ",
		"--date", "2026-06-05",
		"--commit",
	)

	if err == nil {
		t.Fatal("add --commit accepted blank payee")
	}
	if !strings.Contains(err.Error(), "--payee is required") {
		t.Fatalf("expected payee required error, got %q", err.Error())
	}
}

func TestAddCommitRejectsBlankBudgetBeforeTokenResolution(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd,
		"add",
		"--budget", "   ",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "2026-06-05",
		"--commit",
	)

	if err == nil {
		t.Fatal("add --commit accepted blank budget")
	}
	if !strings.Contains(err.Error(), "--budget is required") {
		t.Fatalf("expected budget required error, got %q", err.Error())
	}
}

func TestAddCommitRejectsInvalidDateBeforeTokenResolution(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd,
		"add",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "not-a-date",
		"--commit",
	)

	if err == nil {
		t.Fatal("add --commit accepted invalid date")
	}
	if !strings.Contains(err.Error(), "--date must be YYYY-MM-DD") {
		t.Fatalf("expected date format error, got %q", err.Error())
	}
}

func TestAddDryRunRejectsInvalidDate(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd,
		"add",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "2026-02-31",
	)

	if err == nil {
		t.Fatal("add dry-run accepted invalid date")
	}
	if !strings.Contains(err.Error(), "--date must be YYYY-MM-DD") {
		t.Fatalf("expected date format error, got %q", err.Error())
	}
}

func TestAddDefaultsCurrencyToCLP(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd,
		"add",
		"--account-id", "account-123",
		"--amount", "12.990",
		"--payee", "Comercio",
		"--date", "2026-06-05",
	)

	if err != nil {
		t.Fatalf("add dry-run with default currency returned error: %v", err)
	}
	if !strings.Contains(out.String(), `"amount": -12990000`) {
		t.Fatalf("expected CLP amount by default, got %q", out.String())
	}
}

func TestConfigShowPrintsEmptyObjectWhenNoConfig(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "config", "show")

	if err != nil {
		t.Fatalf("config show returned error: %v", err)
	}
	if out.String() != "{}\n" {
		t.Fatalf("expected empty config object, got %q", out.String())
	}
}

func TestConfigSetDefaultsWritesBudgetAndAccount(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(cmd,
		"config",
		"set-defaults",
		"--budget-id", " budget-123 ",
		"--budget-name", " Household ",
		"--account-id", " account-456 ",
		"--account-name", " Checking ",
	)

	if err != nil {
		t.Fatalf("config set-defaults returned error: %v", err)
	}
	if !store.updateCalled {
		t.Fatal("config set-defaults did not update config")
	}
	want := localconfig.Config{
		DefaultBudgetID:    "budget-123",
		DefaultBudgetName:  "Household",
		DefaultAccountID:   "account-456",
		DefaultAccountName: "Checking",
	}
	if store.update != want {
		t.Fatalf("expected update %#v, got %#v", want, store.update)
	}
	if out.String() != "Config saved.\n" {
		t.Fatalf("expected saved message, got %q", out.String())
	}
}

func TestConfigSetDefaultsCanSetOnlyAccount(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(cmd,
		"config",
		"set-defaults",
		"--account-id", " account-456 ",
		"--account-name", " Checking ",
	)

	if err != nil {
		t.Fatalf("config set-defaults returned error: %v", err)
	}
	want := localconfig.Config{
		DefaultAccountID:   "account-456",
		DefaultAccountName: "Checking",
	}
	if store.update != want {
		t.Fatalf("expected update %#v, got %#v", want, store.update)
	}
}

func TestConfigSetDefaultsRejectsNoIDs(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(cmd,
		"config",
		"set-defaults",
		"--budget-name", "Household",
		"--account-name", "Checking",
	)

	if err == nil {
		t.Fatal("config set-defaults accepted no IDs")
	}
	if !strings.Contains(err.Error(), "at least one default value is required") {
		t.Fatalf("expected missing default error, got %q", err.Error())
	}
	if store.updateCalled {
		t.Fatal("config set-defaults updated config after validation failure")
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

type failingTokenResolver struct {
	t *testing.T
}

func (r failingTokenResolver) Token(context.Context) (string, string, error) {
	r.t.Fatal("token resolver should not be called")
	return "", auth.SourceNone, nil
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

type fakeConfigStore struct {
	config       localconfig.Config
	loadErr      error
	saveErr      error
	updateErr    error
	update       localconfig.Config
	updateCalled bool
}

func (s *fakeConfigStore) Load() (localconfig.Config, error) {
	if s.loadErr != nil {
		return localconfig.Config{}, s.loadErr
	}
	return s.config, nil
}

func (s *fakeConfigStore) Save(cfg localconfig.Config) error {
	if s.saveErr != nil {
		return s.saveErr
	}
	s.config = cfg
	return nil
}

func (s *fakeConfigStore) Update(update localconfig.Config) (localconfig.Config, error) {
	if s.updateErr != nil {
		return localconfig.Config{}, s.updateErr
	}
	s.update = update
	s.updateCalled = true
	if update.DefaultBudgetID != "" {
		s.config.DefaultBudgetID = update.DefaultBudgetID
	}
	if update.DefaultBudgetName != "" {
		s.config.DefaultBudgetName = update.DefaultBudgetName
	}
	if update.DefaultAccountID != "" {
		s.config.DefaultAccountID = update.DefaultAccountID
	}
	if update.DefaultAccountName != "" {
		s.config.DefaultAccountName = update.DefaultAccountName
	}
	return s.config, nil
}

type fakeYNABClient struct {
	plansResponse             []byte
	plansCalled               bool
	accountsBudget            string
	accountsResponse          []byte
	categoriesBudget          string
	categoriesResponse        []byte
	transactionsBudget        string
	transactionsSince         string
	transactionsUntil         string
	transactionsResponse      []byte
	createTransactionBudget   string
	createTransactionPayload  transactions.PostTransactionRequest
	createTransactionResponse []byte
	err                       error
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

func (c *fakeYNABClient) CreateTransaction(_ context.Context, budget string, payload transactions.PostTransactionRequest) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.createTransactionBudget = budget
	c.createTransactionPayload = payload
	return c.createTransactionResponse, nil
}
