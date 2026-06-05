# ynab-expense CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable local Go CLI named `ynab-expense` for safely querying YNAB and creating manual expense transactions through the official API.

**Architecture:** Use a minimal Standard Go Project Layout with Cobra at the CLI boundary and focused `internal` packages for auth, YNAB HTTP, money parsing, and transaction payload construction. Pure packages are implemented and tested first; API and Keychain boundaries are tested with fakes and `httptest`.

**Tech Stack:** Go 1.26, Cobra, `golang.org/x/term` for no-echo token input, Go standard library, macOS `/usr/bin/security`, `httptest`.

---

## File Structure

- Create `go.mod`: module metadata and Cobra dependency.
- Create `cmd/ynab-expense/main.go`: small executable entrypoint.
- Create `internal/money/money.go`: currency-aware amount parsing to YNAB milliunits.
- Create `internal/money/money_test.go`: CLP/USD parsing tests.
- Create `internal/transactions/transaction.go`: memo audit marker, stable import ID, transaction payload builder.
- Create `internal/transactions/transaction_test.go`: payload/default/import ID tests.
- Create `internal/auth/auth.go`: token source resolution, environment lookup, Keychain store.
- Create `internal/auth/auth_test.go`: token precedence and fake Keychain runner tests.
- Create `internal/ynab/client.go`: YNAB HTTP client, response structs, API error handling.
- Create `internal/ynab/client_test.go`: `httptest` coverage for paths, auth header, success, and error handling.
- Create `internal/cli/root.go`: Cobra root and command registration.
- Create `internal/cli/auth.go`: `auth set-token` and `auth status`.
- Create `internal/cli/list.go`: `budgets`, `accounts`, `categories`, `transactions`.
- Create `internal/cli/add.go`: dry-run/commit transaction creation.
- Create `internal/cli/cli_test.go`: Cobra command behavior tests.
- Create `README.md`: install, auth, listing, dry-run, commit, currency examples, safety notes.
- Create `.gitignore`: ignore macOS and build artifacts.

---

### Task 1: Module and CLI Skeleton

**Files:**
- Create: `go.mod`
- Create: `cmd/ynab-expense/main.go`
- Create: `internal/cli/root.go`
- Create: `.gitignore`

- [ ] **Step 1: Initialize module and Cobra dependency**

Run:

```bash
go mod init github.com/birrein/ynab-expense-cli
go get github.com/spf13/cobra@latest
go get golang.org/x/term@latest
```

Expected: `go.mod` and `go.sum` exist and include Cobra plus `golang.org/x/term`.

- [ ] **Step 2: Create `.gitignore`**

Add:

```gitignore
.DS_Store
ynab-expense
dist/
bin/
coverage.out
```

- [ ] **Step 3: Write Cobra root command**

Create `internal/cli/root.go`:

```go
package cli

import (
	"io"

	"github.com/spf13/cobra"
)

type App struct {
	out io.Writer
	err io.Writer
}

func NewRootCommand(out io.Writer, errOut io.Writer) *cobra.Command {
	app := &App{out: out, err: errOut}

	cmd := &cobra.Command{
		Use:           "ynab-expense",
		Short:         "Local YNAB expense helper",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	cmd.SetOut(out)
	cmd.SetErr(errOut)
	_ = app

	return cmd
}
```

- [ ] **Step 4: Write executable entrypoint**

Create `cmd/ynab-expense/main.go`:

```go
package main

import (
	"fmt"
	"os"

	"github.com/birrein/ynab-expense-cli/internal/cli"
)

func main() {
	root := cli.NewRootCommand(os.Stdout, os.Stderr)
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
```

- [ ] **Step 5: Verify skeleton builds**

Run:

```bash
go test ./...
go build ./cmd/ynab-expense
```

Expected: both commands pass.

- [ ] **Step 6: Commit skeleton**

Run:

```bash
git add .gitignore go.mod go.sum cmd/ynab-expense/main.go internal/cli/root.go
git commit -m "feat(cli): scaffold ynab expense command"
```

---

### Task 2: Currency-Aware Money Parsing

**Files:**
- Create: `internal/money/money.go`
- Create: `internal/money/money_test.go`

- [ ] **Step 1: Write failing tests for CLP and USD parsing**

Create `internal/money/money_test.go`:

```go
package money

import "testing"

func TestParseExpenseMilliunitsCLP(t *testing.T) {
	tests := map[string]int64{
		"12.990":  -12990000,
		"$12.990": -12990000,
		"12990":   -12990000,
		"CLP 12.990": -12990000,
	}

	for input, want := range tests {
		got, err := ParseExpenseMilliunits(input, "CLP")
		if err != nil {
			t.Fatalf("ParseExpenseMilliunits(%q, CLP) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("ParseExpenseMilliunits(%q, CLP) = %d, want %d", input, got, want)
		}
	}
}

func TestParseExpenseMilliunitsUSD(t *testing.T) {
	tests := map[string]int64{
		"12.99":  -12990,
		"$12.99": -12990,
		"USD 12.99": -12990,
		"12990":  -12990000,
	}

	for input, want := range tests {
		got, err := ParseExpenseMilliunits(input, "USD")
		if err != nil {
			t.Fatalf("ParseExpenseMilliunits(%q, USD) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("ParseExpenseMilliunits(%q, USD) = %d, want %d", input, got, want)
		}
	}
}

func TestParseExpenseMilliunitsRejectsUnknownCurrency(t *testing.T) {
	_, err := ParseExpenseMilliunits("12.99", "EUR")
	if err == nil {
		t.Fatal("expected error for unsupported currency")
	}
}

func TestParseExpenseMilliunitsRejectsInvalidAmount(t *testing.T) {
	_, err := ParseExpenseMilliunits("abc", "CLP")
	if err == nil {
		t.Fatal("expected error for invalid amount")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/money
```

Expected: FAIL because `ParseExpenseMilliunits` is undefined.

- [ ] **Step 3: Implement money parsing**

Create `internal/money/money.go`:

```go
package money

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode"
)

func ParseExpenseMilliunits(input string, currency string) (int64, error) {
	normalizedCurrency := strings.ToUpper(strings.TrimSpace(currency))
	switch normalizedCurrency {
	case "CLP":
		return parseCLPExpense(input)
	case "USD":
		return parseDecimalExpense(input, normalizedCurrency)
	default:
		return 0, fmt.Errorf("unsupported currency %q; supported currencies: CLP, USD", currency)
	}
}

func parseCLPExpense(input string) (int64, error) {
	text := stripCurrencyText(input)
	text = strings.ReplaceAll(text, ".", "")
	text = strings.ReplaceAll(text, ",", "")
	if text == "" {
		return 0, fmt.Errorf("amount is empty")
	}
	units, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid CLP amount %q", input)
	}
	return -absInt64(units * 1000), nil
}

func parseDecimalExpense(input string, currency string) (int64, error) {
	text := stripCurrencyText(input)
	text = strings.ReplaceAll(text, ",", "")
	if text == "" {
		return 0, fmt.Errorf("amount is empty")
	}
	value, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid %s amount %q", currency, input)
	}
	return -int64(math.Round(math.Abs(value) * 1000)), nil
}

func stripCurrencyText(input string) string {
	text := strings.TrimSpace(input)
	text = strings.ReplaceAll(text, "$", "")
	text = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsSpace(r) {
			return -1
		}
		return r
	}, text)
	return strings.TrimSpace(text)
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
```

- [ ] **Step 4: Run money tests**

Run:

```bash
go test ./internal/money
```

Expected: PASS.

- [ ] **Step 5: Commit money parser**

Run:

```bash
git add internal/money/money.go internal/money/money_test.go
git commit -m "feat(money): parse currency amounts to milliunits"
```

---

### Task 3: Transaction Payload Builder

**Files:**
- Create: `internal/transactions/transaction.go`
- Create: `internal/transactions/transaction_test.go`

- [ ] **Step 1: Write failing transaction tests**

Create `internal/transactions/transaction_test.go`:

```go
package transactions

import "testing"

func TestBuildExpenseDefaults(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID: "account-1",
		Date: "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName: "Comercio",
		CategoryID: "category-1",
		Memo: "",
	})

	if tx.AccountID != "account-1" || tx.Date != "2026-06-05" || tx.Amount != -12990000 {
		t.Fatalf("unexpected basic transaction fields: %+v", tx)
	}
	if tx.PayeeName != "Comercio" || tx.CategoryID == nil || *tx.CategoryID != "category-1" {
		t.Fatalf("unexpected payee/category fields: %+v", tx)
	}
	if tx.Memo != "source=ynab-expense-cli" {
		t.Fatalf("memo = %q", tx.Memo)
	}
	if tx.Cleared != "uncleared" {
		t.Fatalf("cleared = %q", tx.Cleared)
	}
	if tx.Approved {
		t.Fatal("approved should default to false")
	}
	if tx.ImportID == "" || len(tx.ImportID) > 36 {
		t.Fatalf("invalid import_id %q", tx.ImportID)
	}
}

func TestBuildExpenseAppendsAuditMemo(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID: "account-1",
		Date: "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName: "Comercio",
		Memo: "boleta 123",
	})

	if tx.Memo != "boleta 123; source=ynab-expense-cli" {
		t.Fatalf("memo = %q", tx.Memo)
	}
}

func TestBuildExpenseStableImportID(t *testing.T) {
	input := Input{
		AccountID: "account-1",
		Date: "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName: "Comercio",
		Memo: "boleta 123",
	}

	first := BuildExpense(input)
	second := BuildExpense(input)

	if first.ImportID != second.ImportID {
		t.Fatalf("import IDs differ: %q != %q", first.ImportID, second.ImportID)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/transactions
```

Expected: FAIL because `BuildExpense` and `Input` are undefined.

- [ ] **Step 3: Implement transaction builder**

Create `internal/transactions/transaction.go`:

```go
package transactions

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

const SourceMemo = "source=ynab-expense-cli"

type Input struct {
	AccountID string
	Date string
	AmountMilliunits int64
	PayeeName string
	CategoryID string
	Memo string
}

type Transaction struct {
	AccountID string `json:"account_id"`
	Date string `json:"date"`
	Amount int64 `json:"amount"`
	PayeeName string `json:"payee_name"`
	CategoryID *string `json:"category_id,omitempty"`
	Memo string `json:"memo"`
	Cleared string `json:"cleared"`
	Approved bool `json:"approved"`
	ImportID string `json:"import_id"`
}

type PostTransactionRequest struct {
	Transaction Transaction `json:"transaction"`
}

func BuildExpense(input Input) Transaction {
	memo := AuditMemo(input.Memo)
	tx := Transaction{
		AccountID: input.AccountID,
		Date: input.Date,
		Amount: input.AmountMilliunits,
		PayeeName: input.PayeeName,
		Memo: memo,
		Cleared: "uncleared",
		Approved: false,
	}
	if strings.TrimSpace(input.CategoryID) != "" {
		categoryID := strings.TrimSpace(input.CategoryID)
		tx.CategoryID = &categoryID
	}
	tx.ImportID = StableImportID(input.AccountID, input.Date, input.AmountMilliunits, input.PayeeName, memo)
	return tx
}

func AuditMemo(memo string) string {
	clean := strings.TrimSpace(memo)
	if clean == "" {
		return SourceMemo
	}
	if strings.Contains(clean, SourceMemo) {
		return clean
	}
	return clean + "; " + SourceMemo
}

func StableImportID(accountID string, date string, amount int64, payee string, memo string) string {
	material := strings.Join([]string{
		strings.TrimSpace(accountID),
		strings.TrimSpace(date),
		int64String(amount),
		strings.ToLower(strings.TrimSpace(payee)),
		strings.ToLower(strings.TrimSpace(memo)),
	}, "|")
	sum := sha256.Sum256([]byte(material))
	return "YNABEXP:" + strings.ToUpper(hex.EncodeToString(sum[:])[:20])
}

func int64String(value int64) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	var digits [20]byte
	i := len(digits)
	for value > 0 {
		i--
		digits[i] = byte('0' + value%10)
		value /= 10
	}
	if negative {
		i--
		digits[i] = '-'
	}
	return string(digits[i:])
}
```

- [ ] **Step 4: Run transaction tests**

Run:

```bash
go test ./internal/transactions
```

Expected: PASS.

- [ ] **Step 5: Commit transaction builder**

Run:

```bash
git add internal/transactions/transaction.go internal/transactions/transaction_test.go
git commit -m "feat(transactions): build safe expense payloads"
```

---

### Task 4: Token Auth and macOS Keychain Boundary

**Files:**
- Create: `internal/auth/auth.go`
- Create: `internal/auth/auth_test.go`

- [ ] **Step 1: Write failing auth tests**

Create `internal/auth/auth_test.go`:

```go
package auth

import (
	"context"
	"os"
	"reflect"
	"testing"
)

func TestResolverPrefersEnvironmentToken(t *testing.T) {
	t.Setenv("YNAB_API_TOKEN", "from-env")
	store := &fakeStore{token: "from-keychain"}
	resolver := Resolver{Store: store}

	got, source, err := resolver.Token(context.Background())
	if err != nil {
		t.Fatalf("Token returned error: %v", err)
	}
	if got != "from-env" || source != SourceEnv {
		t.Fatalf("got token=%q source=%q", got, source)
	}
}

func TestResolverFallsBackToKeychain(t *testing.T) {
	os.Unsetenv("YNAB_API_TOKEN")
	store := &fakeStore{token: "from-keychain"}
	resolver := Resolver{Store: store}

	got, source, err := resolver.Token(context.Background())
	if err != nil {
		t.Fatalf("Token returned error: %v", err)
	}
	if got != "from-keychain" || source != SourceKeychain {
		t.Fatalf("got token=%q source=%q", got, source)
	}
}

func TestKeychainStoreBuildsSecurityCommands(t *testing.T) {
	var calls [][]string
	store := KeychainStore{
		Account: "tester",
		Service: "ynab-expense",
		Run: func(ctx context.Context, name string, args ...string) ([]byte, error) {
			calls = append(calls, append([]string{name}, args...))
			return []byte("stored-token\n"), nil
		},
	}

	token, err := store.Get(context.Background())
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if token != "stored-token" {
		t.Fatalf("token = %q", token)
	}

	err = store.Set(context.Background(), "secret-token")
	if err != nil {
		t.Fatalf("Set returned error: %v", err)
	}

	wantGet := []string{"/usr/bin/security", "find-generic-password", "-a", "tester", "-s", "ynab-expense", "-w"}
	wantSet := []string{"/usr/bin/security", "add-generic-password", "-U", "-a", "tester", "-s", "ynab-expense", "-w", "secret-token"}
	if !reflect.DeepEqual(calls[0], wantGet) {
		t.Fatalf("get command = %#v", calls[0])
	}
	if !reflect.DeepEqual(calls[1], wantSet) {
		t.Fatalf("set command = %#v", calls[1])
	}
}

type fakeStore struct {
	token string
}

func (f *fakeStore) Get(ctx context.Context) (string, error) {
	return f.token, nil
}

func (f *fakeStore) Set(ctx context.Context, token string) error {
	f.token = token
	return nil
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/auth
```

Expected: FAIL because auth types are undefined.

- [ ] **Step 3: Implement auth package**

Create `internal/auth/auth.go`:

```go
package auth

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"os/user"
	"strings"
)

const (
	SourceEnv = "env:YNAB_API_TOKEN"
	SourceKeychain = "macOS Keychain"
	SourceNone = "not configured"
	DefaultService = "ynab-expense"
)

var ErrTokenNotFound = errors.New("YNAB token not found")

type TokenStore interface {
	Get(ctx context.Context) (string, error)
	Set(ctx context.Context, token string) error
}

type Resolver struct {
	Store TokenStore
}

func (r Resolver) Token(ctx context.Context) (string, string, error) {
	if token := strings.TrimSpace(os.Getenv("YNAB_API_TOKEN")); token != "" {
		return token, SourceEnv, nil
	}
	if r.Store == nil {
		return "", SourceNone, ErrTokenNotFound
	}
	token, err := r.Store.Get(ctx)
	if err != nil || strings.TrimSpace(token) == "" {
		return "", SourceNone, ErrTokenNotFound
	}
	return strings.TrimSpace(token), SourceKeychain, nil
}

type Runner func(ctx context.Context, name string, args ...string) ([]byte, error)

type KeychainStore struct {
	Account string
	Service string
	Run Runner
}

func NewKeychainStore() KeychainStore {
	account := ""
	if current, err := user.Current(); err == nil {
		account = current.Username
	}
	return KeychainStore{Account: account, Service: DefaultService, Run: runCommand}
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
	return runCommand
}

func (s KeychainStore) service() string {
	if s.Service != "" {
		return s.Service
	}
	return DefaultService
}

func runCommand(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).Output()
}
```

- [ ] **Step 4: Run auth tests**

Run:

```bash
go test ./internal/auth
```

Expected: PASS.

- [ ] **Step 5: Commit auth package**

Run:

```bash
git add internal/auth/auth.go internal/auth/auth_test.go
git commit -m "feat(auth): resolve ynab token from env and keychain"
```

---

### Task 5: YNAB HTTP Client

**Files:**
- Create: `internal/ynab/client.go`
- Create: `internal/ynab/client_test.go`

- [ ] **Step 1: Write failing YNAB client tests**

Create `internal/ynab/client_test.go`:

```go
package ynab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

func TestClientGetPlansUsesAuthHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer token-123" {
			t.Fatalf("Authorization = %q", r.Header.Get("Authorization"))
		}
		writeJSON(w, map[string]any{"data": map[string]any{"plans": []any{map[string]any{"id": "p1", "name": "Main"}}}})
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	body, err := client.GetPlans(context.Background())
	if err != nil {
		t.Fatalf("GetPlans returned error: %v", err)
	}
	if !strings.Contains(string(body), "\"Main\"") {
		t.Fatalf("response missing plan name: %s", body)
	}
}

func TestClientGetTransactionsUsesSinceAndUntil(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans/default/transactions" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.URL.Query().Get("since_date") != "2026-06-01" || r.URL.Query().Get("until_date") != "2026-06-05" {
			t.Fatalf("query = %s", r.URL.RawQuery)
		}
		writeJSON(w, map[string]any{"data": map[string]any{"transactions": []any{}}})
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetTransactions(context.Background(), "default", "2026-06-01", "2026-06-05")
	if err != nil {
		t.Fatalf("GetTransactions returned error: %v", err)
	}
}

func TestClientCreateTransactionPostsPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		if r.URL.Path != "/plans/default/transactions" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		var payload transactions.PostTransactionRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if payload.Transaction.ImportID == "" {
			t.Fatal("missing import_id")
		}
		w.WriteHeader(http.StatusCreated)
		writeJSON(w, map[string]any{"data": map[string]any{"transaction_ids": []string{"t1"}, "server_knowledge": 1}})
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.CreateTransaction(context.Background(), "default", transactions.PostTransactionRequest{
		Transaction: transactions.BuildExpense(transactions.Input{AccountID: "a1", Date: "2026-06-05", AmountMilliunits: -12990, PayeeName: "Store"}),
	})
	if err != nil {
		t.Fatalf("CreateTransaction returned error: %v", err)
	}
}

func TestClientReturnsReadableAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		writeJSON(w, map[string]any{"error": map[string]any{"id": "401", "name": "not_authorized", "detail": "Invalid token"}})
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetPlans(context.Background())
	if err == nil {
		t.Fatal("expected API error")
	}
	if !strings.Contains(err.Error(), "401") || !strings.Contains(err.Error(), "not_authorized") || !strings.Contains(err.Error(), "Invalid token") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/ynab
```

Expected: FAIL because `NewClient` and methods are undefined.

- [ ] **Step 3: Implement YNAB client**

Create `internal/ynab/client.go`:

```go
package ynab

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

const DefaultBaseURL = "https://api.ynab.com/v1"

type Client struct {
	baseURL string
	token string
	httpClient *http.Client
}

func NewClient(baseURL string, token string, httpClient *http.Client) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{baseURL: strings.TrimRight(baseURL, "/"), token: token, httpClient: httpClient}
}

func (c *Client) GetPlans(ctx context.Context) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/plans", nil, nil)
}

func (c *Client) GetAccounts(ctx context.Context, budget string) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/plans/"+url.PathEscape(budget)+"/accounts", nil, nil)
}

func (c *Client) GetCategories(ctx context.Context, budget string) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/plans/"+url.PathEscape(budget)+"/categories", nil, nil)
}

func (c *Client) GetTransactions(ctx context.Context, budget string, since string, until string) ([]byte, error) {
	query := url.Values{}
	if since != "" {
		query.Set("since_date", since)
	}
	if until != "" {
		query.Set("until_date", until)
	}
	return c.do(ctx, http.MethodGet, "/plans/"+url.PathEscape(budget)+"/transactions", query, nil)
}

func (c *Client) CreateTransaction(ctx context.Context, budget string, payload transactions.PostTransactionRequest) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/plans/"+url.PathEscape(budget)+"/transactions", nil, payload)
}

func (c *Client) do(ctx context.Context, method string, path string, query url.Values, payload any) ([]byte, error) {
	var body io.Reader
	if payload != nil {
		var buf bytes.Buffer
		if err := json.NewEncoder(&buf).Encode(payload); err != nil {
			return nil, fmt.Errorf("encode request: %w", err)
		}
		body = &buf
	}

	requestURL := c.baseURL + path
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, parseAPIError(resp.StatusCode, responseBody)
	}
	return responseBody, nil
}

func parseAPIError(status int, body []byte) error {
	var payload struct {
		Error struct {
			ID string `json:"id"`
			Name string `json:"name"`
			Detail string `json:"detail"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err == nil && payload.Error.Name != "" {
		return fmt.Errorf("YNAB API error %d %s: %s", status, payload.Error.Name, payload.Error.Detail)
	}
	return fmt.Errorf("YNAB API error %d: %s", status, strings.TrimSpace(string(body)))
}
```

- [ ] **Step 4: Run YNAB client tests**

Run:

```bash
go test ./internal/ynab
```

Expected: PASS.

- [ ] **Step 5: Commit YNAB client**

Run:

```bash
git add internal/ynab/client.go internal/ynab/client_test.go
git commit -m "feat(ynab): add official api client"
```

---

### Task 6: Cobra Auth and Listing Commands

**Files:**
- Modify: `internal/cli/root.go`
- Create: `internal/cli/auth.go`
- Create: `internal/cli/list.go`
- Create: `internal/cli/cli_test.go`

- [ ] **Step 1: Write failing CLI tests for auth status and budgets**

Create `internal/cli/cli_test.go`:

```go
package cli

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestAuthStatusDoesNotPrintToken(t *testing.T) {
	var out bytes.Buffer
	root := NewRootCommand(&out, &bytes.Buffer{})
	root.SetArgs([]string{"auth", "status"})
	root.SetContext(context.WithValue(context.Background(), testTokenKey{}, "secret-token"))

	if err := root.Execute(); err != nil {
		t.Fatalf("Execute returned error: %v", err)
	}
	if strings.Contains(out.String(), "secret-token") {
		t.Fatalf("status printed token: %s", out.String())
	}
}

func TestBudgetsRequiresTokenWhenNoTestToken(t *testing.T) {
	var out bytes.Buffer
	var errOut bytes.Buffer
	root := NewRootCommand(&out, &errOut)
	root.SetArgs([]string{"budgets"})

	err := root.Execute()
	if err == nil {
		t.Fatal("expected missing token error")
	}
	if !strings.Contains(err.Error(), "No YNAB token found") {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/cli
```

Expected: FAIL because commands are not registered.

- [ ] **Step 3: Add auth and list command structure**

Modify `internal/cli/root.go`:

```go
package cli

import (
	"io"

	"github.com/spf13/cobra"
)

type App struct {
	out io.Writer
	err io.Writer
}

type testTokenKey struct{}

func NewRootCommand(out io.Writer, errOut io.Writer) *cobra.Command {
	app := &App{out: out, err: errOut}

	cmd := &cobra.Command{
		Use:           "ynab-expense",
		Short:         "Local YNAB expense helper",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	cmd.SetOut(out)
	cmd.SetErr(errOut)
	cmd.AddCommand(app.newAuthCommand())
	cmd.AddCommand(app.newBudgetsCommand())
	cmd.AddCommand(app.newAccountsCommand())
	cmd.AddCommand(app.newCategoriesCommand())
	cmd.AddCommand(app.newTransactionsCommand())
	return cmd
}
```

Create `internal/cli/auth.go`:

```go
package cli

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/birrein/ynab-expense-cli/internal/auth"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

func (a *App) newAuthCommand() *cobra.Command {
	cmd := &cobra.Command{Use: "auth", Short: "Manage YNAB authentication"}
	cmd.AddCommand(a.newAuthStatusCommand())
	cmd.AddCommand(a.newAuthSetTokenCommand())
	return cmd
}

func (a *App) newAuthStatusCommand() *cobra.Command {
	return &cobra.Command{
		Use: "status",
		Short: "Show token configuration status",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, source, err := tokenFromContextOrResolver(cmd.Context())
			if err != nil {
				fmt.Fprintln(a.out, "not configured")
				return nil
			}
			fmt.Fprintf(a.out, "configured: %s\n", source)
			return nil
		},
	}
}

func (a *App) newAuthSetTokenCommand() *cobra.Command {
	return &cobra.Command{
		Use: "set-token [token]",
		Short: "Store a YNAB Personal Access Token in macOS Keychain",
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := ""
			if len(args) > 0 {
				token = strings.TrimSpace(args[0])
			} else {
				fmt.Fprint(a.err, "YNAB Personal Access Token: ")
				secret, err := term.ReadPassword(int(os.Stdin.Fd()))
				fmt.Fprintln(a.err)
				if err != nil {
					return err
				}
				token = strings.TrimSpace(string(secret))
			}
			if token == "" {
				return fmt.Errorf("token cannot be empty")
			}
			store := auth.NewKeychainStore()
			if err := store.Set(cmd.Context(), token); err != nil {
				return err
			}
			fmt.Fprintln(a.out, "Token saved in macOS Keychain.")
			return nil
		},
	}
}

func tokenFromContextOrResolver(ctx context.Context) (string, string, error) {
	if token, ok := ctx.Value(testTokenKey{}).(string); ok && token != "" {
		return token, "test", nil
	}
	resolver := auth.Resolver{Store: auth.NewKeychainStore()}
	token, source, err := resolver.Token(ctx)
	if err != nil {
		return "", source, fmt.Errorf("No YNAB token found. Run `ynab-expense auth set-token` or export YNAB_API_TOKEN.")
	}
	return token, source, nil
}
```

Create `internal/cli/list.go`:

```go
package cli

import (
	"fmt"

	"github.com/birrein/ynab-expense-cli/internal/ynab"
	"github.com/spf13/cobra"
)

func (a *App) newBudgetsCommand() *cobra.Command {
	return &cobra.Command{
		Use: "budgets",
		Short: "List YNAB budgets/plans",
		RunE: func(cmd *cobra.Command, args []string) error {
			token, _, err := tokenFromContextOrResolver(cmd.Context())
			if err != nil {
				return err
			}
			client := ynab.NewClient("", token, nil)
			body, err := client.GetPlans(cmd.Context())
			if err != nil {
				return err
			}
			fmt.Fprintln(a.out, string(body))
			return nil
		},
	}
}

func (a *App) newAccountsCommand() *cobra.Command {
	var budget string
	cmd := &cobra.Command{
		Use: "accounts",
		Short: "List accounts for a budget",
		RunE: func(cmd *cobra.Command, args []string) error {
			token, _, err := tokenFromContextOrResolver(cmd.Context())
			if err != nil {
				return err
			}
			body, err := ynab.NewClient("", token, nil).GetAccounts(cmd.Context(), budget)
			if err != nil {
				return err
			}
			fmt.Fprintln(a.out, string(body))
			return nil
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget/plan id")
	return cmd
}

func (a *App) newCategoriesCommand() *cobra.Command {
	var budget string
	cmd := &cobra.Command{
		Use: "categories",
		Short: "List categories for a budget",
		RunE: func(cmd *cobra.Command, args []string) error {
			token, _, err := tokenFromContextOrResolver(cmd.Context())
			if err != nil {
				return err
			}
			body, err := ynab.NewClient("", token, nil).GetCategories(cmd.Context(), budget)
			if err != nil {
				return err
			}
			fmt.Fprintln(a.out, string(body))
			return nil
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget/plan id")
	return cmd
}

func (a *App) newTransactionsCommand() *cobra.Command {
	var budget string
	var since string
	var until string
	cmd := &cobra.Command{
		Use: "transactions",
		Short: "List transactions for a budget",
		RunE: func(cmd *cobra.Command, args []string) error {
			token, _, err := tokenFromContextOrResolver(cmd.Context())
			if err != nil {
				return err
			}
			body, err := ynab.NewClient("", token, nil).GetTransactions(cmd.Context(), budget, since, until)
			if err != nil {
				return err
			}
			fmt.Fprintln(a.out, string(body))
			return nil
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget/plan id")
	cmd.Flags().StringVar(&since, "since", "", "ISO date lower bound")
	cmd.Flags().StringVar(&until, "until", "", "ISO date upper bound")
	return cmd
}
```

- [ ] **Step 4: Run CLI package tests**

Run:

```bash
go test ./internal/cli
```

Expected: PASS.

- [ ] **Step 5: Commit auth/list commands**

Run:

```bash
git add internal/cli/root.go internal/cli/auth.go internal/cli/list.go internal/cli/cli_test.go
git commit -m "feat(cli): add auth and listing commands"
```

---

### Task 7: Cobra Add Command With Dry-Run and Commit

**Files:**
- Modify: `internal/cli/root.go`
- Create: `internal/cli/add.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing tests for add dry-run, flag conflicts, and commit token requirement**

Append to `internal/cli/cli_test.go`:

```go
func TestAddDryRunDoesNotRequireToken(t *testing.T) {
	var out bytes.Buffer
	root := NewRootCommand(&out, &bytes.Buffer{})
	root.SetArgs([]string{"add", "--budget", "default", "--account-id", "account-1", "--amount", "12.990", "--currency", "CLP", "--payee", "Comercio", "--date", "2026-06-05", "--dry-run"})

	if err := root.Execute(); err != nil {
		t.Fatalf("Execute returned error: %v", err)
	}
	output := out.String()
	if !strings.Contains(output, `"dry_run": true`) || !strings.Contains(output, `"amount": -12990000`) || !strings.Contains(output, `"source=ynab-expense-cli"`) {
		t.Fatalf("unexpected dry-run output: %s", output)
	}
}

func TestAddRejectsDryRunAndCommitTogether(t *testing.T) {
	root := NewRootCommand(&bytes.Buffer{}, &bytes.Buffer{})
	root.SetArgs([]string{"add", "--account-id", "account-1", "--amount", "12.990", "--payee", "Comercio", "--date", "2026-06-05", "--dry-run", "--commit"})

	err := root.Execute()
	if err == nil {
		t.Fatal("expected conflict error")
	}
	if !strings.Contains(err.Error(), "--dry-run cannot be used with --commit") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestAddCommitRequiresToken(t *testing.T) {
	root := NewRootCommand(&bytes.Buffer{}, &bytes.Buffer{})
	root.SetArgs([]string{"add", "--account-id", "account-1", "--amount", "12.990", "--currency", "CLP", "--payee", "Comercio", "--date", "2026-06-05", "--commit"})

	err := root.Execute()
	if err == nil {
		t.Fatal("expected token error")
	}
	if !strings.Contains(err.Error(), "No YNAB token found") {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/cli
```

Expected: FAIL because `add` is not registered.

- [ ] **Step 3: Register add command**

Modify `internal/cli/root.go` so command registration includes `app.newAddCommand()`:

```go
cmd.AddCommand(app.newAddCommand())
```

- [ ] **Step 4: Implement add command**

Create `internal/cli/add.go`:

```go
package cli

import (
	"encoding/json"
	"fmt"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
	"github.com/birrein/ynab-expense-cli/internal/ynab"
	"github.com/spf13/cobra"
)

func (a *App) newAddCommand() *cobra.Command {
	var budget string
	var accountID string
	var amount string
	var currency string
	var payee string
	var date string
	var categoryID string
	var memo string
	var dryRun bool
	var commit bool

	cmd := &cobra.Command{
		Use: "add",
		Short: "Create or preview a YNAB expense transaction",
		RunE: func(cmd *cobra.Command, args []string) error {
			if dryRun && commit {
				return fmt.Errorf("--dry-run cannot be used with --commit")
			}
			amountMilliunits, err := money.ParseExpenseMilliunits(amount, currency)
			if err != nil {
				return err
			}
			tx := transactions.BuildExpense(transactions.Input{
				AccountID: accountID,
				Date: date,
				AmountMilliunits: amountMilliunits,
				PayeeName: payee,
				CategoryID: categoryID,
				Memo: memo,
			})
			payload := transactions.PostTransactionRequest{Transaction: tx}
			if !commit {
				return writePrettyJSON(a.out, map[string]any{"dry_run": true, "budget": budget, "payload": payload})
			}
			token, _, err := tokenFromContextOrResolver(cmd.Context())
			if err != nil {
				return err
			}
			body, err := ynab.NewClient("", token, nil).CreateTransaction(cmd.Context(), budget, payload)
			if err != nil {
				return err
			}
			fmt.Fprintln(a.out, string(body))
			return nil
		},
	}

	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget/plan id")
	cmd.Flags().StringVar(&accountID, "account-id", "", "YNAB account id")
	cmd.Flags().StringVar(&amount, "amount", "", "expense amount")
	cmd.Flags().StringVar(&currency, "currency", "CLP", "input currency: CLP or USD")
	cmd.Flags().StringVar(&payee, "payee", "", "payee name")
	cmd.Flags().StringVar(&date, "date", "", "transaction date YYYY-MM-DD")
	cmd.Flags().StringVar(&categoryID, "category-id", "", "YNAB category id")
	cmd.Flags().StringVar(&memo, "memo", "", "transaction memo")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "preview the transaction without writing to YNAB")
	cmd.Flags().BoolVar(&commit, "commit", false, "write the transaction to YNAB")
	_ = cmd.MarkFlagRequired("account-id")
	_ = cmd.MarkFlagRequired("amount")
	_ = cmd.MarkFlagRequired("payee")
	_ = cmd.MarkFlagRequired("date")
	return cmd
}

func writePrettyJSON(out anyWriter, value any) error {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(out, string(encoded))
	return err
}

type anyWriter interface {
	Write([]byte) (int, error)
}
```

- [ ] **Step 5: Run CLI tests**

Run:

```bash
go test ./internal/cli
```

Expected: PASS.

- [ ] **Step 6: Commit add command**

Run:

```bash
git add internal/cli/root.go internal/cli/add.go internal/cli/cli_test.go
git commit -m "feat(cli): add dry-run expense command"
```

---

### Task 8: README, Full Verification, and Local Install

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:

```markdown
# ynab-expense-cli

Local Go CLI for querying YNAB and safely creating manual expense transactions.

This is not an official YNAB CLI. It uses the official YNAB API at `https://api.ynab.com/v1`.

## Install

```bash
go install ./cmd/ynab-expense
```

Or build a local binary:

```bash
go build -o ynab-expense ./cmd/ynab-expense
```

## Authentication

Store a YNAB Personal Access Token in macOS Keychain:

```bash
ynab-expense auth set-token
```

For non-interactive use:

```bash
ynab-expense auth set-token "your-token"
```

You can also use an environment variable. It takes precedence over Keychain:

```bash
export YNAB_API_TOKEN="your-token"
```

Check status without printing secrets:

```bash
ynab-expense auth status
```

## Listing Data

```bash
ynab-expense budgets
ynab-expense accounts --budget default
ynab-expense categories --budget default
ynab-expense transactions --budget default --since 2026-06-01
```

The CLI says `budget` because that is the familiar YNAB vocabulary. The current YNAB API uses `plans` internally.

## Add an Expense

Dry-run is the default. This prints the payload and does not write to YNAB:

```bash
ynab-expense add \
  --budget default \
  --account-id ACCOUNT_ID \
  --amount 12.990 \
  --currency CLP \
  --payee "Comercio" \
  --date 2026-06-05 \
  --dry-run
```

Write only when you pass `--commit`:

```bash
ynab-expense add \
  --budget default \
  --account-id ACCOUNT_ID \
  --amount 12.990 \
  --currency CLP \
  --payee "Comercio" \
  --date 2026-06-05 \
  --commit
```

New transactions are `uncleared`, unapproved, and include `source=ynab-expense-cli` in the memo by default.

## Amount Parsing

YNAB stores amounts in milliunits. The CLI supports currency-aware parsing:

```text
CLP: "$12.990", "12.990", "12990" => -12990000
USD: "$12.99", "12.99" => -12990
USD: "12990" => -12990000
```

For USD, an amount without a decimal separator means whole dollars.

## Safety

- Tokens are never printed.
- `add` does not write unless `--commit` is present.
- `import_id` is stable for retries to reduce duplicates.
- The MVP only creates expenses, not inflows.

## Development

```bash
go test ./...
go build ./cmd/ynab-expense
```
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 3: Build local binary**

Run:

```bash
go build -o ynab-expense ./cmd/ynab-expense
./ynab-expense --help
```

Expected: binary builds and help prints available commands.

- [ ] **Step 4: Verify dry-run locally**

Run:

```bash
./ynab-expense add --budget default --account-id account-1 --amount 12.990 --currency CLP --payee "Comercio" --date 2026-06-05 --dry-run
```

Expected: pretty JSON includes `"dry_run": true`, `"amount": -12990000`, `"cleared": "uncleared"`, `"approved": false`, and `"source=ynab-expense-cli"`.

- [ ] **Step 5: Commit README and verification support**

Run:

```bash
git add README.md
git commit -m "docs(readme): document ynab expense cli usage"
```

---

## Self-Review

- Spec coverage: The plan covers Cobra, minimal Go layout, Keychain via `/usr/bin/security`, `YNAB_API_TOKEN` fallback, listing commands, dry-run by default, `--commit`, stable `import_id`, CLP/USD parsing, `uncleared` and unapproved defaults, source memo, README, tests, build, and local dry-run verification.
- Placeholder scan: No `TODO`, `TBD`, or "implement later" placeholders are present.
- Type consistency: The plan uses `money.ParseExpenseMilliunits`, `transactions.BuildExpense`, `transactions.PostTransactionRequest`, `auth.Resolver`, `auth.KeychainStore`, `ynab.NewClient`, and `cli.NewRootCommand` consistently across tasks.
