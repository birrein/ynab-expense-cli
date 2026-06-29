# Edit Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `ynab-expense edit` for safe read-before-write transaction edits, including create-then-delete replacement for split transactions.

**Architecture:** Add edit payload builders to `internal/transactions`, extend the YNAB HTTP client with get/patch/delete transaction methods, then add a focused `internal/cli/edit.go` command that orchestrates validation, preview output, simple PATCH commits, and split replacement commits. The CLI follows the existing local config, token, dry-run, and fake-client test patterns.

**Tech Stack:** Go, Cobra, standard `net/http` and `encoding/json`, existing `internal/money`, `internal/transactions`, `internal/ynab`, and `internal/cli` packages.

---

## Files

- Modify: `internal/transactions/transaction.go`
- Modify: `internal/transactions/transaction_test.go`
- Modify: `internal/ynab/client.go`
- Modify: `internal/ynab/client_test.go`
- Modify: `internal/cli/root.go`
- Create: `internal/cli/edit.go`
- Modify: `internal/cli/cli_test.go`
- Modify: `README.md`

## Scope Notes

- Keep `add` behavior unchanged.
- `edit` dry-run requires token because it reads the current transaction from YNAB.
- Simple edits use `PATCH /plans/{plan_id}/transactions`.
- Split edits use `GET original -> POST replacement -> DELETE original`.
- Do not support changing or setting `import_id` on existing transactions.
- Do not add account/category lookup by name.

### Task 1: Transaction Patch Payloads

**Files:**
- Modify: `internal/transactions/transaction.go`
- Modify: `internal/transactions/transaction_test.go`

- [ ] **Step 1: Add failing tests for patch payload construction**

Append these tests to `internal/transactions/transaction_test.go`:

```go
func TestBuildPatchTrimsAndIncludesExplicitFields(t *testing.T) {
	amount := int64(-3990000)
	categoryID := " category-monthly "
	memo := " Uber One "
	approved := false

	patch := BuildPatch(PatchInput{
		ID:         " tx-123 ",
		AccountID:  " account-456 ",
		Date:       " 2026-06-27 ",
		Amount:     &amount,
		PayeeName:  " Uber ",
		CategoryID: &categoryID,
		Memo:       &memo,
		Cleared:    " uncleared ",
		Approved:   &approved,
	})

	if patch.ID != "tx-123" {
		t.Fatalf("ID = %q, want tx-123", patch.ID)
	}
	if patch.AccountID != "account-456" {
		t.Fatalf("AccountID = %q, want account-456", patch.AccountID)
	}
	if patch.Date != "2026-06-27" {
		t.Fatalf("Date = %q, want 2026-06-27", patch.Date)
	}
	if patch.Amount == nil || *patch.Amount != -3990000 {
		t.Fatalf("Amount = %#v, want -3990000", patch.Amount)
	}
	if patch.PayeeName != "Uber" {
		t.Fatalf("PayeeName = %q, want Uber", patch.PayeeName)
	}
	if patch.CategoryID == nil || *patch.CategoryID != "category-monthly" {
		t.Fatalf("CategoryID = %#v, want category-monthly", patch.CategoryID)
	}
	if patch.Memo == nil || *patch.Memo != "Uber One" {
		t.Fatalf("Memo = %#v, want Uber One", patch.Memo)
	}
	if patch.Cleared != "uncleared" {
		t.Fatalf("Cleared = %q, want uncleared", patch.Cleared)
	}
	if patch.Approved == nil || *patch.Approved {
		t.Fatalf("Approved = %#v, want false", patch.Approved)
	}
}

func TestBuildPatchOmitsUnsetOptionalFields(t *testing.T) {
	patch := BuildPatch(PatchInput{ID: "tx-123"})

	body, err := json.Marshal(PatchTransactionsRequest{Transactions: []PatchTransaction{patch}})
	if err != nil {
		t.Fatal(err)
	}
	got := string(body)
	for _, unwanted := range []string{"account_id", "amount", "category_id", "memo", "approved"} {
		if strings.Contains(got, unwanted) {
			t.Fatalf("patch JSON %s unexpectedly contains %s", got, unwanted)
		}
	}
	if !strings.Contains(got, `"id":"tx-123"`) {
		t.Fatalf("patch JSON %s missing id", got)
	}
}
```

Also add imports at the top of `internal/transactions/transaction_test.go`:

```go
import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"
)
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```sh
go test ./internal/transactions -run 'TestBuildPatch' -count=1
```

Expected: FAIL with `undefined: BuildPatch`, `undefined: PatchInput`, or related missing type errors.

- [ ] **Step 3: Implement patch payload types and builder**

Add this code near the existing transaction types in `internal/transactions/transaction.go`:

```go
type PatchTransactionsRequest struct {
	Transactions []PatchTransaction `json:"transactions"`
}

type PatchTransaction struct {
	ID         string  `json:"id,omitempty"`
	ImportID   string  `json:"import_id,omitempty"`
	AccountID  string  `json:"account_id,omitempty"`
	Date       string  `json:"date,omitempty"`
	Amount     *int64  `json:"amount,omitempty"`
	PayeeName  string  `json:"payee_name,omitempty"`
	CategoryID *string `json:"category_id,omitempty"`
	Memo       *string `json:"memo,omitempty"`
	Cleared    string  `json:"cleared,omitempty"`
	Approved   *bool   `json:"approved,omitempty"`
}

type PatchInput struct {
	ID         string
	ImportID   string
	AccountID  string
	Date       string
	Amount     *int64
	PayeeName  string
	CategoryID *string
	Memo       *string
	Cleared    string
	Approved   *bool
}

func BuildPatch(input PatchInput) PatchTransaction {
	patch := PatchTransaction{
		ID:        strings.TrimSpace(input.ID),
		ImportID:  strings.TrimSpace(input.ImportID),
		AccountID: strings.TrimSpace(input.AccountID),
		Date:      strings.TrimSpace(input.Date),
		Amount:    input.Amount,
		PayeeName: strings.TrimSpace(input.PayeeName),
		Cleared:   strings.TrimSpace(input.Cleared),
		Approved:  input.Approved,
	}
	if input.CategoryID != nil {
		categoryID := strings.TrimSpace(*input.CategoryID)
		patch.CategoryID = &categoryID
	}
	if input.Memo != nil {
		memo := strings.TrimSpace(*input.Memo)
		patch.Memo = &memo
	}
	return patch
}
```

- [ ] **Step 4: Run transaction tests**

Run:

```sh
go test ./internal/transactions -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit transaction payloads**

Run:

```sh
git add internal/transactions/transaction.go internal/transactions/transaction_test.go
git commit -m "feat(transactions): add edit patch payloads"
```

### Task 2: YNAB Transaction Edit Client Methods

**Files:**
- Modify: `internal/ynab/client.go`
- Modify: `internal/ynab/client_test.go`

- [ ] **Step 1: Add failing client tests**

Append these tests to `internal/ynab/client_test.go`:

```go
func TestClientGetTransactionUsesEscapedPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %q, want GET", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/budget%2Fid/transactions/tx%2Fid" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		if got := r.Header.Get("Authorization"); got != "Bearer token-123" {
			t.Fatalf("Authorization = %q, want Bearer token-123", got)
		}
		_, _ = w.Write([]byte(`{"data":{"transaction":{"id":"tx/id"}}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	body, err := client.GetTransaction(context.Background(), "budget/id", "tx/id")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"tx/id"`) {
		t.Fatalf("body = %s", body)
	}
}

func TestClientPatchTransactionsSendsPatchPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Fatalf("method = %q, want PATCH", r.Method)
		}
		if r.URL.Path != "/plans/default/transactions" {
			t.Fatalf("path = %q, want /plans/default/transactions", r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q, want application/json", got)
		}
		var payload transactions.PatchTransactionsRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Transactions) != 1 || payload.Transactions[0].ID != "tx-123" {
			t.Fatalf("payload = %#v", payload)
		}
		_, _ = w.Write([]byte(`{"data":{"transaction_ids":["tx-123"]}}`))
	}))
	defer server.Close()

	memo := "Uber One"
	payload := transactions.PatchTransactionsRequest{
		Transactions: []transactions.PatchTransaction{
			transactions.BuildPatch(transactions.PatchInput{ID: "tx-123", Memo: &memo}),
		},
	}
	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.PatchTransactions(context.Background(), "default", payload)
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientDeleteTransactionUsesDelete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Fatalf("method = %q, want DELETE", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/default/transactions/tx%2F123" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		_, _ = w.Write([]byte(`{"data":{"transaction":{"id":"tx/123","deleted":true}}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.DeleteTransaction(context.Background(), "default", "tx/123")
	if err != nil {
		t.Fatal(err)
	}
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```sh
go test ./internal/ynab -run 'TestClient(GetTransaction|PatchTransactions|DeleteTransaction)' -count=1
```

Expected: FAIL with missing method errors on `*Client`.

- [ ] **Step 3: Implement client methods**

Add these methods to `internal/ynab/client.go`:

```go
func (c *Client) GetTransaction(ctx context.Context, budget string, transactionID string) ([]byte, error) {
	return c.get(ctx, "/plans/"+url.PathEscape(budget)+"/transactions/"+url.PathEscape(transactionID))
}

func (c *Client) PatchTransactions(ctx context.Context, budget string, payload transactions.PatchTransactionsRequest) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, http.MethodPatch, "/plans/"+url.PathEscape(budget)+"/transactions", body)
}

func (c *Client) DeleteTransaction(ctx context.Context, budget string, transactionID string) ([]byte, error) {
	return c.do(ctx, http.MethodDelete, "/plans/"+url.PathEscape(budget)+"/transactions/"+url.PathEscape(transactionID), nil)
}
```

- [ ] **Step 4: Run client tests**

Run:

```sh
go test ./internal/ynab -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit YNAB client methods**

Run:

```sh
git add internal/ynab/client.go internal/ynab/client_test.go
git commit -m "feat(ynab): add transaction edit endpoints"
```

### Task 3: Register Edit Command and Fake Client Support

**Files:**
- Modify: `internal/cli/root.go`
- Create: `internal/cli/edit.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing tests for command registration and basic validation**

Add these tests after the existing add command tests in `internal/cli/cli_test.go`:

```go
func TestEditRejectsMissingID(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--memo", "Uber One")

	if err == nil {
		t.Fatal("edit accepted missing id")
	}
	if !strings.Contains(err.Error(), "--id is required") {
		t.Fatalf("expected id required error, got %q", err.Error())
	}
}

func TestEditRejectsNoEditFields(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123")

	if err == nil {
		t.Fatal("edit accepted no edit fields")
	}
	if !strings.Contains(err.Error(), "at least one edit field is required") {
		t.Fatalf("expected edit field error, got %q", err.Error())
	}
}

func TestEditRejectsDryRunAndCommitTogether(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--memo", "Uber One", "--dry-run", "--commit")

	if err == nil {
		t.Fatal("edit accepted --dry-run with --commit")
	}
	if !strings.Contains(err.Error(), "--dry-run cannot be used with --commit") {
		t.Fatalf("expected dry-run conflict error, got %q", err.Error())
	}
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```sh
go test ./internal/cli -run 'TestEditRejects' -count=1
```

Expected: FAIL because `edit` is not a registered command.

- [ ] **Step 3: Extend `ynabClient` and fake client**

Modify the `ynabClient` interface in `internal/cli/root.go` so it includes:

```go
	GetTransaction(context.Context, string, string) ([]byte, error)
	PatchTransactions(context.Context, string, transactions.PatchTransactionsRequest) ([]byte, error)
	DeleteTransaction(context.Context, string, string) ([]byte, error)
```

Modify `fakeYNABClient` in `internal/cli/cli_test.go` to add fields:

```go
	getTransactionBudget       string
	getTransactionID           string
	getTransactionResponse     []byte
	patchTransactionsBudget    string
	patchTransactionsPayload   transactions.PatchTransactionsRequest
	patchTransactionsResponse  []byte
	deleteTransactionBudget    string
	deleteTransactionID        string
	deleteTransactionResponse  []byte
	createTransactionErr       error
	deleteTransactionErr       error
```

Add methods to `fakeYNABClient`:

```go
func (c *fakeYNABClient) GetTransaction(_ context.Context, budget string, transactionID string) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.getTransactionBudget = budget
	c.getTransactionID = transactionID
	return c.getTransactionResponse, nil
}

func (c *fakeYNABClient) PatchTransactions(_ context.Context, budget string, payload transactions.PatchTransactionsRequest) ([]byte, error) {
	if c.err != nil {
		return nil, c.err
	}
	c.patchTransactionsBudget = budget
	c.patchTransactionsPayload = payload
	return c.patchTransactionsResponse, nil
}

func (c *fakeYNABClient) DeleteTransaction(_ context.Context, budget string, transactionID string) ([]byte, error) {
	if c.deleteTransactionErr != nil {
		return nil, c.deleteTransactionErr
	}
	if c.err != nil {
		return nil, c.err
	}
	c.deleteTransactionBudget = budget
	c.deleteTransactionID = transactionID
	return c.deleteTransactionResponse, nil
}
```

Update fake `CreateTransaction` so it honors `createTransactionErr` before `err`:

```go
func (c *fakeYNABClient) CreateTransaction(_ context.Context, budget string, payload transactions.PostTransactionRequest) ([]byte, error) {
	if c.createTransactionErr != nil {
		return nil, c.createTransactionErr
	}
	if c.err != nil {
		return nil, c.err
	}
	c.createTransactionBudget = budget
	c.createTransactionPayload = payload
	return c.createTransactionResponse, nil
}
```

- [ ] **Step 4: Create minimal `edit` command validation**

Create `internal/cli/edit.go` with this starter implementation:

```go
package cli

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

type editOptions struct {
	budget       string
	id           string
	accountID    string
	date         string
	amount       string
	currency     string
	payee        string
	categoryID   string
	memo         string
	cleared      string
	approved     bool
	filePath     string
	dryRun       bool
	commit       bool
	replaceSplit bool
}

func (a *App) newEditCommand() *cobra.Command {
	opts := editOptions{currency: "CLP"}
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Edit an existing YNAB transaction",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.runEdit(cmd, opts)
		},
	}
	cmd.Flags().StringVar(&opts.budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&opts.id, "id", "", "YNAB transaction ID")
	cmd.Flags().StringVar(&opts.accountID, "account-id", "", "New YNAB account ID")
	cmd.Flags().StringVar(&opts.date, "date", "", "New transaction date in YYYY-MM-DD")
	cmd.Flags().StringVar(&opts.amount, "amount", "", "New expense amount")
	cmd.Flags().StringVar(&opts.currency, "currency", "CLP", "Amount currency")
	cmd.Flags().StringVar(&opts.payee, "payee", "", "New payee name")
	cmd.Flags().StringVar(&opts.categoryID, "category-id", "", "New YNAB category ID")
	cmd.Flags().StringVar(&opts.memo, "memo", "", "New transaction memo")
	cmd.Flags().StringVar(&opts.cleared, "cleared", "", "New cleared status")
	cmd.Flags().BoolVar(&opts.approved, "approved", false, "New approved status")
	cmd.Flags().StringVar(&opts.filePath, "file", "", "Read replacement split input from a JSON file")
	cmd.Flags().BoolVar(&opts.dryRun, "dry-run", false, "Preview edit without sending it")
	cmd.Flags().BoolVar(&opts.commit, "commit", false, "Commit edit to YNAB")
	cmd.Flags().BoolVar(&opts.replaceSplit, "replace-split", false, "Replace a transaction with a split transaction from --file")
	return cmd
}

func (a *App) runEdit(cmd *cobra.Command, opts editOptions) error {
	if opts.dryRun && opts.commit {
		return fmt.Errorf("--dry-run cannot be used with --commit")
	}
	opts.id = strings.TrimSpace(opts.id)
	if opts.id == "" {
		return fmt.Errorf("--id is required")
	}
	if !cmd.Flags().Changed("file") && !opts.replaceSplit && len(editDetailFlagsChanged(cmd)) == 0 {
		return fmt.Errorf("at least one edit field is required")
	}
	return fmt.Errorf("edit command is not implemented")
}

func editDetailFlagsChanged(cmd *cobra.Command) []string {
	names := []string{"account-id", "date", "amount", "payee", "category-id", "memo", "cleared", "approved"}
	changed := make([]string, 0, len(names))
	for _, name := range names {
		if cmd.Flags().Changed(name) {
			changed = append(changed, "--"+name)
		}
	}
	return changed
}
```

Register the command in `internal/cli/root.go`:

```go
cmd.AddCommand(app.newEditCommand())
```

- [ ] **Step 5: Run validation tests**

Run:

```sh
go test ./internal/cli -run 'TestEditRejects' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit command shell**

Run:

```sh
git add internal/cli/root.go internal/cli/edit.go internal/cli/cli_test.go
git commit -m "feat(cli): add edit command shell"
```

### Task 4: Simple Edit Validation, Dry-Run, and Commit

**Files:**
- Modify: `internal/cli/edit.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing tests for simple edit behavior**

Add these tests to `internal/cli/cli_test.go`:

```go
func TestEditRejectsCurrencyWithoutAmount(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--currency", "USD", "--memo", "Uber One")

	if err == nil {
		t.Fatal("edit accepted currency without amount")
	}
	if !strings.Contains(err.Error(), "--currency requires --amount") {
		t.Fatalf("expected currency error, got %q", err.Error())
	}
}

func TestEditRejectsInvalidDate(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--date", "2026-02-31")

	if err == nil {
		t.Fatal("edit accepted invalid date")
	}
	if !strings.Contains(err.Error(), "--date must be YYYY-MM-DD") {
		t.Fatalf("expected date error, got %q", err.Error())
	}
}

func TestEditRejectsInvalidClearedStatus(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--cleared", "maybe")

	if err == nil {
		t.Fatal("edit accepted invalid cleared status")
	}
	if !strings.Contains(err.Error(), "--cleared must be one of: cleared, uncleared, reconciled") {
		t.Fatalf("expected cleared error, got %q", err.Error())
	}
}

func TestEditDryRunRequiresToken(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: fakeTokenResolver{err: auth.ErrTokenNotFound},
	})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--memo", "Uber One")

	if err == nil {
		t.Fatal("edit dry-run returned nil error without token")
	}
	if !strings.Contains(err.Error(), "No YNAB token found") {
		t.Fatalf("expected missing-token error, got %q", err.Error())
	}
}

func TestEditDryRunPrintsBeforeAndPatch(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		getTransactionResponse: []byte(`{"data":{"transaction":{"id":"tx-123","account_id":"account-1","date":"2026-06-27","amount":-3990000,"payee_name":"Uber","category_id":"transportation","memo":"old memo","subtransactions":[]}}}`),
	}
	cmd := commandWithFakeClientAndConfig(&out, client, localconfig.Config{DefaultBudgetID: "budget-config"})

	err := executeCommand(cmd, "edit", "--id", " tx-123 ", "--memo", " Uber One ", "--category-id", " monthly-subscriptions ")

	if err != nil {
		t.Fatalf("edit dry-run returned error: %v", err)
	}
	if client.getTransactionBudget != "budget-config" {
		t.Fatalf("budget = %q, want budget-config", client.getTransactionBudget)
	}
	if client.getTransactionID != "tx-123" {
		t.Fatalf("transaction id = %q, want tx-123", client.getTransactionID)
	}
	output := out.String()
	for _, want := range []string{
		`"dry_run": true`,
		`"operation": "edit"`,
		`"before"`,
		`"patch"`,
		`"category_id": "monthly-subscriptions"`,
		`"memo": "Uber One"`,
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("edit output missing %s, got %q", want, output)
		}
	}
}

func TestEditCommitPatchesTransaction(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{
		getTransactionResponse:    []byte(`{"data":{"transaction":{"id":"tx-123","account_id":"account-1","date":"2026-06-27","amount":-3990000,"payee_name":"Uber","subtransactions":[]}}}`),
		patchTransactionsResponse: []byte(`{"data":{"transaction_ids":["tx-123"]}}`),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd,
		"edit",
		"--budget", " default ",
		"--id", "tx-123",
		"--amount", "3990",
		"--currency", "CLP",
		"--date", "2026-06-27",
		"--payee", "Uber",
		"--approved=false",
		"--commit",
	)

	if err != nil {
		t.Fatalf("edit commit returned error: %v", err)
	}
	if client.patchTransactionsBudget != "default" {
		t.Fatalf("patch budget = %q, want default", client.patchTransactionsBudget)
	}
	if len(client.patchTransactionsPayload.Transactions) != 1 {
		t.Fatalf("patch payload = %#v", client.patchTransactionsPayload)
	}
	patch := client.patchTransactionsPayload.Transactions[0]
	if patch.ID != "tx-123" || patch.Date != "2026-06-27" || patch.PayeeName != "Uber" {
		t.Fatalf("patch = %#v", patch)
	}
	if patch.Amount == nil || *patch.Amount != -3990000 {
		t.Fatalf("amount = %#v, want -3990000", patch.Amount)
	}
	if patch.Approved == nil || *patch.Approved {
		t.Fatalf("approved = %#v, want false", patch.Approved)
	}
	if !strings.Contains(out.String(), `"transaction_ids"`) {
		t.Fatalf("edit commit output missing response JSON, got %q", out.String())
	}
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```sh
go test ./internal/cli -run 'TestEdit(RejectsCurrency|RejectsInvalid|DryRun|Commit)' -count=1
```

Expected: FAIL because `runEdit` still returns `edit command is not implemented`.

- [ ] **Step 3: Implement simple edit validation and patch construction**

Replace the body of `internal/cli/edit.go` with a full simple-edit path. Keep the existing options and command setup, then add imports:

```go
import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
	"github.com/spf13/cobra"
)
```

Add these local types:

```go
type editDryRunOutput struct {
	DryRun        bool                          `json:"dry_run"`
	Budget        string                        `json:"budget"`
	Operation     string                        `json:"operation"`
	TransactionID string                        `json:"transaction_id"`
	Before        json.RawMessage               `json:"before"`
	Patch         transactions.PatchTransaction `json:"patch"`
}

type transactionResponse struct {
	Data struct {
		Transaction rawTransaction `json:"transaction"`
	} `json:"data"`
}

type rawTransaction struct {
	ID              string            `json:"id"`
	AccountID       string            `json:"account_id"`
	Date            string            `json:"date"`
	Amount          int64             `json:"amount"`
	PayeeName       string            `json:"payee_name"`
	CategoryID      *string           `json:"category_id"`
	Memo            *string           `json:"memo"`
	Subtransactions []json.RawMessage `json:"subtransactions"`
}
```

Implement these helper functions:

```go
func validateEditCommon(cmd *cobra.Command, opts *editOptions) error {
	if opts.dryRun && opts.commit {
		return fmt.Errorf("--dry-run cannot be used with --commit")
	}
	opts.id = strings.TrimSpace(opts.id)
	if opts.id == "" {
		return fmt.Errorf("--id is required")
	}
	if cmd.Flags().Changed("currency") && !cmd.Flags().Changed("amount") {
		return fmt.Errorf("--currency requires --amount")
	}
	if strings.TrimSpace(opts.date) != "" {
		parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(opts.date))
		if err != nil || parsedDate.Format("2006-01-02") != strings.TrimSpace(opts.date) {
			return fmt.Errorf("--date must be YYYY-MM-DD")
		}
	}
	if strings.TrimSpace(opts.cleared) != "" {
		switch strings.TrimSpace(opts.cleared) {
		case "cleared", "uncleared", "reconciled":
		default:
			return fmt.Errorf("--cleared must be one of: cleared, uncleared, reconciled")
		}
	}
	return nil
}

func parseTransactionResponse(body []byte) (rawTransaction, json.RawMessage, error) {
	var wrapper struct {
		Data struct {
			Transaction json.RawMessage `json:"transaction"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return rawTransaction{}, nil, err
	}
	if len(wrapper.Data.Transaction) == 0 {
		return rawTransaction{}, nil, fmt.Errorf("transaction response missing transaction")
	}
	var tx rawTransaction
	if err := json.Unmarshal(wrapper.Data.Transaction, &tx); err != nil {
		return rawTransaction{}, nil, err
	}
	return tx, wrapper.Data.Transaction, nil
}
```

Implement `buildSimpleEditPatch`:

```go
func buildSimpleEditPatch(cmd *cobra.Command, opts editOptions) (transactions.PatchTransaction, error) {
	input := transactions.PatchInput{ID: opts.id}
	if cmd.Flags().Changed("account-id") {
		accountID := strings.TrimSpace(opts.accountID)
		if accountID == "" {
			return transactions.PatchTransaction{}, fmt.Errorf("--account-id is required")
		}
		input.AccountID = accountID
	}
	if cmd.Flags().Changed("date") {
		input.Date = strings.TrimSpace(opts.date)
	}
	if cmd.Flags().Changed("amount") {
		milliunits, err := money.ParseExpenseMilliunits(opts.amount, opts.currency)
		if err != nil {
			return transactions.PatchTransaction{}, err
		}
		input.Amount = &milliunits
	}
	if cmd.Flags().Changed("payee") {
		payee := strings.TrimSpace(opts.payee)
		if payee == "" {
			return transactions.PatchTransaction{}, fmt.Errorf("--payee is required")
		}
		input.PayeeName = payee
	}
	if cmd.Flags().Changed("category-id") {
		categoryID := strings.TrimSpace(opts.categoryID)
		if categoryID == "" {
			return transactions.PatchTransaction{}, fmt.Errorf("--category-id is required")
		}
		input.CategoryID = &categoryID
	}
	if cmd.Flags().Changed("memo") {
		memo := strings.TrimSpace(opts.memo)
		input.Memo = &memo
	}
	if cmd.Flags().Changed("cleared") {
		input.Cleared = strings.TrimSpace(opts.cleared)
	}
	if cmd.Flags().Changed("approved") {
		input.Approved = &opts.approved
	}
	return transactions.BuildPatch(input), nil
}
```

Then update `runEdit` for the simple path:

```go
func (a *App) runEdit(cmd *cobra.Command, opts editOptions) error {
	if err := validateEditCommon(cmd, &opts); err != nil {
		return err
	}
	if cmd.Flags().Changed("file") || opts.replaceSplit {
		return a.runReplaceSplitEdit(cmd, opts)
	}
	if len(editDetailFlagsChanged(cmd)) == 0 {
		return fmt.Errorf("at least one edit field is required")
	}

	resolvedBudget, err := a.resolveBudget(cmd, opts.budget)
	if err != nil {
		return err
	}
	patch, err := buildSimpleEditPatch(cmd, opts)
	if err != nil {
		return err
	}
	client, err := a.clientForCommand(cmd)
	if err != nil {
		return err
	}
	body, err := client.GetTransaction(cmd.Context(), resolvedBudget, opts.id)
	if err != nil {
		return err
	}
	_, rawBefore, err := parseTransactionResponse(body)
	if err != nil {
		return err
	}
	if !opts.commit {
		preview, err := json.MarshalIndent(editDryRunOutput{
			DryRun:        true,
			Budget:        resolvedBudget,
			Operation:     "edit",
			TransactionID: opts.id,
			Before:        rawBefore,
			Patch:         patch,
		}, "", "  ")
		if err != nil {
			return err
		}
		return a.writeJSON(preview)
	}
	response, err := client.PatchTransactions(cmd.Context(), resolvedBudget, transactions.PatchTransactionsRequest{
		Transactions: []transactions.PatchTransaction{patch},
	})
	if err != nil {
		return err
	}
	return a.writeJSON(response)
}
```

Add a stub `runReplaceSplitEdit` so compilation succeeds until Task 5:

```go
func (a *App) runReplaceSplitEdit(cmd *cobra.Command, opts editOptions) error {
	return fmt.Errorf("replace-split edit is not implemented")
}
```

- [ ] **Step 4: Run simple edit tests**

Run:

```sh
go test ./internal/cli -run 'TestEdit(Rejects|DryRun|Commit)' -count=1
```

Expected: PASS for simple edit tests. Existing replace-split tests do not exist yet.

- [ ] **Step 5: Run full CLI tests**

Run:

```sh
go test ./internal/cli -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit simple edit behavior**

Run:

```sh
git add internal/cli/edit.go internal/cli/cli_test.go
git commit -m "feat(cli): support simple transaction edits"
```

### Task 5: Split Replacement Dry-Run and Commit

**Files:**
- Modify: `internal/cli/edit.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing tests for replace-split validation and dry-run**

Add these tests to `internal/cli/cli_test.go`:

```go
func TestEditFileRequiresReplaceSplit(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{"date":"2026-06-28","amount":1000,"payee":"Store","category_id":"category"}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--file", path)

	if err == nil {
		t.Fatal("edit accepted --file without --replace-split")
	}
	if !strings.Contains(err.Error(), "--file requires --replace-split") {
		t.Fatalf("expected file requires replace-split error, got %q", err.Error())
	}
}

func TestEditReplaceSplitRequiresFile(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--replace-split")

	if err == nil {
		t.Fatal("edit accepted --replace-split without --file")
	}
	if !strings.Contains(err.Error(), "--replace-split requires --file") {
		t.Fatalf("expected replace-split requires file error, got %q", err.Error())
	}
}

func TestEditReplaceSplitRejectsDetailFlags(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-28",
		"amount": 10990,
		"payee": "Main Merchant",
		"splits": [
			{"amount": 10000, "category_id": "primary-category"},
			{"amount": 990, "category_id": "fee-category"}
		]
	}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--file", path, "--replace-split", "--memo", "new memo")

	if err == nil {
		t.Fatal("edit accepted detail flags with replace-split file")
	}
	if !strings.Contains(err.Error(), "--file cannot be combined with transaction detail flags") {
		t.Fatalf("expected mixed input error, got %q", err.Error())
	}
}

func TestEditReplaceSplitDryRunInheritsOriginalAccount(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-28",
		"amount": 10990,
		"payee": "Main Merchant",
		"memo": "Corrected split",
		"splits": [
			{"amount": 10000, "category_id": "primary-category"},
			{"amount": 990, "category_id": "fee-category"}
		]
	}`)
	client := &fakeYNABClient{
		getTransactionResponse: []byte(`{"data":{"transaction":{"id":"tx-123","account_id":"original-account","date":"2026-06-28","amount":-10990000,"payee_name":"Main Merchant","subtransactions":[{"id":"sub-1"}]}}}`),
	}
	cmd := commandWithFakeClientAndConfig(&out, client, localconfig.Config{
		DefaultBudgetID:  "budget-config",
		DefaultAccountID: "default-account",
	})

	err := executeCommand(cmd, "edit", "--id", "tx-123", "--file", path, "--replace-split")

	if err != nil {
		t.Fatalf("replace-split dry-run returned error: %v", err)
	}
	output := out.String()
	for _, want := range []string{
		`"operation": "replace_split"`,
		`"warning": "commit will create a replacement transaction and delete the original transaction"`,
		`"original_transaction_id": "tx-123"`,
		`"account_id": "original-account"`,
		`"subtransactions"`,
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("replace-split output missing %s, got %q", want, output)
		}
	}
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```sh
go test ./internal/cli -run 'TestEdit(File|ReplaceSplit)' -count=1
```

Expected: FAIL because `runReplaceSplitEdit` is still a stub.

- [ ] **Step 3: Implement replace-split dry-run**

Add output types to `internal/cli/edit.go`:

```go
type replaceSplitDryRunOutput struct {
	DryRun                bool                                `json:"dry_run"`
	Budget                string                              `json:"budget"`
	Operation             string                              `json:"operation"`
	Warning               string                              `json:"warning"`
	OriginalTransactionID string                              `json:"original_transaction_id"`
	Original              json.RawMessage                     `json:"original"`
	ReplacementPayload    transactions.PostTransactionRequest `json:"replacement_payload"`
}
```

Add a helper for replace-split flag validation:

```go
func validateReplaceSplitFlags(cmd *cobra.Command, opts editOptions) error {
	if cmd.Flags().Changed("file") && !opts.replaceSplit {
		return fmt.Errorf("--file requires --replace-split")
	}
	if opts.replaceSplit && !cmd.Flags().Changed("file") {
		return fmt.Errorf("--replace-split requires --file")
	}
	if changed := editDetailFlagsChanged(cmd); len(changed) > 0 {
		return fmt.Errorf("--file cannot be combined with transaction detail flags: %s", strings.Join(changed, ", "))
	}
	return nil
}
```

Replace the stub with:

```go
func (a *App) runReplaceSplitEdit(cmd *cobra.Command, opts editOptions) error {
	if err := validateReplaceSplitFlags(cmd, opts); err != nil {
		return err
	}
	fileInput, err := loadAddFileInput(opts.filePath)
	if err != nil {
		return err
	}
	normalized, err := normalizeAddFileInput(fileInput)
	if err != nil {
		return err
	}
	if len(normalized.Splits) == 0 {
		return fmt.Errorf("splits are required for --replace-split")
	}

	resolvedBudget, err := a.resolveBudget(cmd, opts.budget)
	if err != nil {
		return err
	}
	if normalized.ExplicitBudget {
		resolvedBudget, err = a.resolveBudgetFromValue(cmd, normalized.Budget, true)
		if err != nil {
			return err
		}
		normalized.Budget = resolvedBudget
	}

	client, err := a.clientForCommand(cmd)
	if err != nil {
		return err
	}
	body, err := client.GetTransaction(cmd.Context(), resolvedBudget, opts.id)
	if err != nil {
		return err
	}
	original, rawOriginal, err := parseTransactionResponse(body)
	if err != nil {
		return err
	}
	if normalized.ExplicitAccount {
		accountID, err := a.resolveAccountIDFromValue(normalized.AccountID, true)
		if err != nil {
			return err
		}
		normalized.AccountID = accountID
	} else {
		if strings.TrimSpace(original.AccountID) == "" {
			return fmt.Errorf("original transaction response missing account_id")
		}
		normalized.AccountID = strings.TrimSpace(original.AccountID)
	}

	input, err := validateAddInput(normalized.addInput)
	if err != nil {
		return err
	}
	payload := transactions.PostTransactionRequest{
		Transaction: transactions.BuildExpense(transactions.Input{
			AccountID:        input.AccountID,
			Date:             input.Date,
			AmountMilliunits: normalized.AmountMilliunits,
			PayeeName:        input.Payee,
			CategoryID:       input.CategoryID,
			Memo:             input.Memo,
			Splits:           normalized.Splits,
		}),
	}
	if !opts.commit {
		preview, err := json.MarshalIndent(replaceSplitDryRunOutput{
			DryRun:                true,
			Budget:                resolvedBudget,
			Operation:             "replace_split",
			Warning:               "commit will create a replacement transaction and delete the original transaction",
			OriginalTransactionID: opts.id,
			Original:              rawOriginal,
			ReplacementPayload:    payload,
		}, "", "  ")
		if err != nil {
			return err
		}
		return a.writeJSON(preview)
	}
	return a.commitReplaceSplit(cmd, client, resolvedBudget, opts.id, payload)
}
```

Add a stub for commit until the next step:

```go
func (a *App) commitReplaceSplit(cmd *cobra.Command, client ynabClient, budget string, originalID string, payload transactions.PostTransactionRequest) error {
	return fmt.Errorf("replace-split commit is not implemented")
}
```

- [ ] **Step 4: Run replace-split dry-run tests**

Run:

```sh
go test ./internal/cli -run 'TestEdit(File|ReplaceSplit.*DryRun|ReplaceSplitRequires|ReplaceSplitRejects)' -count=1
```

Expected: PASS for validation and dry-run tests.

- [ ] **Step 5: Add failing commit tests**

Add these tests to `internal/cli/cli_test.go`:

```go
func TestEditReplaceSplitCommitCreatesBeforeDeleting(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-28",
		"amount": 10990,
		"payee": "Main Merchant",
		"splits": [
			{"amount": 10000, "category_id": "primary-category"},
			{"amount": 990, "category_id": "fee-category"}
		]
	}`)
	client := &fakeYNABClient{
		getTransactionResponse:     []byte(`{"data":{"transaction":{"id":"old-tx","account_id":"original-account","subtransactions":[{"id":"sub-1"}]}}}`),
		createTransactionResponse:  []byte(`{"data":{"transaction":{"id":"new-tx"}}}`),
		deleteTransactionResponse:  []byte(`{"data":{"transaction":{"id":"old-tx","deleted":true}}}`),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd, "edit", "--budget", "default", "--id", "old-tx", "--file", path, "--replace-split", "--commit")

	if err != nil {
		t.Fatalf("replace-split commit returned error: %v", err)
	}
	if client.createTransactionBudget != "default" {
		t.Fatalf("create budget = %q, want default", client.createTransactionBudget)
	}
	if client.deleteTransactionID != "old-tx" {
		t.Fatalf("delete id = %q, want old-tx", client.deleteTransactionID)
	}
	if client.createTransactionPayload.Transaction.AccountID != "original-account" {
		t.Fatalf("replacement account = %q", client.createTransactionPayload.Transaction.AccountID)
	}
	output := out.String()
	for _, want := range []string{`"operation": "replace_split"`, `"created_transaction_id": "new-tx"`, `"deleted_transaction_id": "old-tx"`} {
		if !strings.Contains(output, want) {
			t.Fatalf("output missing %s, got %q", want, output)
		}
	}
}

func TestEditReplaceSplitCreateFailureDoesNotDeleteOriginal(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-28",
		"amount": 10990,
		"payee": "Main Merchant",
		"splits": [
			{"amount": 10000, "category_id": "primary-category"},
			{"amount": 990, "category_id": "fee-category"}
		]
	}`)
	client := &fakeYNABClient{
		getTransactionResponse: []byte(`{"data":{"transaction":{"id":"old-tx","account_id":"original-account","subtransactions":[{"id":"sub-1"}]}}}`),
		createTransactionErr:  errors.New("create failed"),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd, "edit", "--id", "old-tx", "--file", path, "--replace-split", "--commit")

	if err == nil {
		t.Fatal("replace-split commit returned nil error after create failure")
	}
	if client.deleteTransactionID != "" {
		t.Fatalf("delete was called for %q after create failure", client.deleteTransactionID)
	}
}

func TestEditReplaceSplitDeleteFailureReportsBothIDs(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-28",
		"amount": 10990,
		"payee": "Main Merchant",
		"splits": [
			{"amount": 10000, "category_id": "primary-category"},
			{"amount": 990, "category_id": "fee-category"}
		]
	}`)
	client := &fakeYNABClient{
		getTransactionResponse:    []byte(`{"data":{"transaction":{"id":"old-tx","account_id":"original-account","subtransactions":[{"id":"sub-1"}]}}}`),
		createTransactionResponse: []byte(`{"data":{"transaction":{"id":"new-tx"}}}`),
		deleteTransactionErr:      errors.New("delete failed"),
	}
	cmd := commandWithFakeClient(&out, client)

	err := executeCommand(cmd, "edit", "--id", "old-tx", "--file", path, "--replace-split", "--commit")

	if err == nil {
		t.Fatal("replace-split commit returned nil error after delete failure")
	}
	for _, want := range []string{"new-tx", "old-tx", "delete failed"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q missing %q", err.Error(), want)
		}
	}
}
```

Ensure `internal/cli/cli_test.go` imports `errors`.

- [ ] **Step 6: Run commit tests and verify they fail**

Run:

```sh
go test ./internal/cli -run 'TestEditReplaceSplit.*Commit|TestEditReplaceSplit.*Failure' -count=1
```

Expected: FAIL because `commitReplaceSplit` is still a stub.

- [ ] **Step 7: Implement replace-split commit output**

Add these types and helpers to `internal/cli/edit.go`:

```go
type replaceSplitCommitOutput struct {
	Operation            string          `json:"operation"`
	DeletedTransactionID string          `json:"deleted_transaction_id"`
	CreatedTransactionID string          `json:"created_transaction_id"`
	CreatedTransaction   json.RawMessage `json:"created_transaction"`
	DeleteResponse       json.RawMessage `json:"delete_response"`
}

func createdTransactionFromResponse(body []byte) (string, json.RawMessage, error) {
	var wrapper struct {
		Data struct {
			Transaction json.RawMessage `json:"transaction"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return "", nil, err
	}
	if len(wrapper.Data.Transaction) == 0 {
		return "", nil, fmt.Errorf("create transaction response missing transaction")
	}
	var tx struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(wrapper.Data.Transaction, &tx); err != nil {
		return "", nil, err
	}
	if strings.TrimSpace(tx.ID) == "" {
		return "", nil, fmt.Errorf("create transaction response missing transaction id")
	}
	return tx.ID, wrapper.Data.Transaction, nil
}
```

Replace the stub:

```go
func (a *App) commitReplaceSplit(cmd *cobra.Command, client ynabClient, budget string, originalID string, payload transactions.PostTransactionRequest) error {
	createBody, err := client.CreateTransaction(cmd.Context(), budget, payload)
	if err != nil {
		return err
	}
	createdID, createdTransaction, err := createdTransactionFromResponse(createBody)
	if err != nil {
		return err
	}
	deleteBody, err := client.DeleteTransaction(cmd.Context(), budget, originalID)
	if err != nil {
		return fmt.Errorf("replacement transaction %s was created, but original transaction %s could not be deleted: %w", createdID, originalID, err)
	}
	body, err := json.MarshalIndent(replaceSplitCommitOutput{
		Operation:            "replace_split",
		DeletedTransactionID: originalID,
		CreatedTransactionID: createdID,
		CreatedTransaction:   createdTransaction,
		DeleteResponse:       json.RawMessage(deleteBody),
	}, "", "  ")
	if err != nil {
		return err
	}
	return a.writeJSON(body)
}
```

- [ ] **Step 8: Run replace-split tests**

Run:

```sh
go test ./internal/cli -run 'TestEdit(File|ReplaceSplit)' -count=1
```

Expected: PASS.

- [ ] **Step 9: Run full CLI tests**

Run:

```sh
go test ./internal/cli -count=1
```

Expected: PASS.

- [ ] **Step 10: Commit split replacement**

Run:

```sh
git add internal/cli/edit.go internal/cli/cli_test.go
git commit -m "feat(cli): replace split transactions"
```

### Task 6: README Documentation and Full Verification

**Files:**
- Modify: `README.md`
- Read: `docs/superpowers/specs/2026-06-29-edit-transactions-design.md`

- [ ] **Step 1: Add README documentation**

Add a new section after the existing `Add Expenses` section in `README.md`:

````markdown
## Edit Transactions

`edit` reads the current YNAB transaction before writing anything. Dry-run is the default, but unlike `add`, edit dry-runs require a configured token because the CLI must fetch the existing transaction.

Simple edits use flags:

```sh
ynab-expense edit \
  --id transaction-id \
  --memo "Uber One" \
  --category-id category-id \
  --dry-run
```

Write the edit only with `--commit`:

```sh
ynab-expense edit \
  --id transaction-id \
  --amount 3990 \
  --currency CLP \
  --date 2026-06-27 \
  --memo "Uber One" \
  --commit
```

Supported simple edit fields:

- `--account-id`
- `--date`
- `--amount`
- `--currency`
- `--payee`
- `--category-id`
- `--memo`
- `--cleared`
- `--approved`

Split line edits are handled by replacing the transaction from a JSON file. This creates the replacement first and deletes the original only after the replacement succeeds:

```sh
ynab-expense edit \
  --id original-transaction-id \
  --file corrected-split.json \
  --replace-split \
  --dry-run

ynab-expense edit \
  --id original-transaction-id \
  --file corrected-split.json \
  --replace-split \
  --commit
```

If replacement creation succeeds but deleting the original fails, the CLI reports both transaction IDs so you can clean up manually.
````

- [ ] **Step 2: Run full test suite**

Run:

```sh
go test ./... -count=1
```

Expected: PASS.

- [ ] **Step 3: Build binary**

Run:

```sh
go build -o ynab-expense ./cmd/ynab-expense
```

Expected: exits 0 and creates `./ynab-expense`.

- [ ] **Step 4: Run non-token validation smoke**

Run:

```sh
./ynab-expense edit --id tx-123
```

Expected: fails before token lookup with:

```text
at least one edit field is required
```

- [ ] **Step 5: Run dry-run smoke with fake-safe validation**

Run:

```sh
./ynab-expense edit --id '   ' --memo "Uber One"
```

Expected: fails before token lookup with:

```text
--id is required
```

- [ ] **Step 6: Remove local binary**

Run:

```sh
rm -f ./ynab-expense
```

Expected: `git status --short` does not show the binary.

- [ ] **Step 7: Review diff for personal data**

Run:

```sh
git diff -- README.md internal/transactions/transaction.go internal/transactions/transaction_test.go internal/ynab/client.go internal/ynab/client_test.go internal/cli/root.go internal/cli/edit.go internal/cli/cli_test.go
```

Expected: no real budget IDs, account IDs, category IDs, transaction IDs, merchant details from personal history, or private generated files.

- [ ] **Step 8: Commit docs and final verification**

Run:

```sh
git add README.md
git commit -m "docs(edit): document transaction edits"
```

### Task 7: Final Integration Check

**Files:**
- Read: full working tree

- [ ] **Step 1: Confirm all expected commits exist**

Run:

```sh
git log --oneline -6
```

Expected: includes commits equivalent to:

```text
docs(edit): document transaction edits
feat(cli): replace split transactions
feat(cli): support simple transaction edits
feat(cli): add edit command shell
feat(ynab): add transaction edit endpoints
feat(transactions): add edit patch payloads
```

- [ ] **Step 2: Run final verification bundle**

Run:

```sh
go test ./... -count=1
go build -o ynab-expense ./cmd/ynab-expense
rm -f ./ynab-expense
git status --short
```

Expected:

- tests pass
- build exits 0
- binary removed
- `git status --short` is clean

- [ ] **Step 3: Mark the implementation plan complete**

Edit this plan file and change all completed checkboxes from `- [ ]` to `- [x]` as each step is completed during execution. Do not mark unchecked work complete.

- [ ] **Step 4: Commit plan progress if it changed**

If the plan file checkboxes were updated, run:

```sh
git add docs/superpowers/plans/2026-06-29-edit-transactions.md
git commit -m "docs(edit): mark edit transactions plan complete"
```
