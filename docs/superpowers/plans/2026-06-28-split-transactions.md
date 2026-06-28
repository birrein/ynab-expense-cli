# Split Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ynab-expense add --file expense.json` support for simple and split expense transactions.

**Architecture:** Keep the current flag-based `add` flow intact while adding a second file-based input path. Extend `internal/transactions` so one builder can create both simple and split YNAB payloads, then add a focused CLI file parser/normalizer that produces the same internal `addInput` shape before dry-run or commit.

**Tech Stack:** Go standard library, Cobra, existing `internal/money` amount parser, existing `internal/transactions` payload builder, existing fake CLI dependencies.

---

## File Structure

- Modify `internal/transactions/transaction.go`: add split input/output types, include splits in payloads, and include split details in stable import IDs.
- Modify `internal/transactions/transaction_test.go`: add split payload and import ID tests.
- Create `internal/cli/add_file.go`: parse `--file` JSON, reject unknown fields, accept string/number amounts, validate file input, and normalize into `addInput`.
- Create `internal/cli/add_file_test.go`: focused parser and validation tests for JSON files.
- Modify `internal/cli/add.go`: add `--file`, reject mixed file/detail flags, route file input through defaults, and build split payloads.
- Modify `internal/cli/cli_test.go`: add end-to-end Cobra tests for `add --file` dry-run/commit behavior.
- Modify `README.md`: document `add --file`, simple JSON, split JSON, dry-run/commit safety, and private-file guidance.

---

### Task 1: Transaction Payload Split Support

**Files:**
- Modify: `internal/transactions/transaction.go`
- Modify: `internal/transactions/transaction_test.go`

- [ ] **Step 1: Add failing tests for split transaction payloads**

Append these tests to `internal/transactions/transaction_test.go`:

```go
func TestBuildExpenseWithSplitsOmitsParentCategoryAndAddsSubtransactions(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID:        "account-123",
		Date:             "2026-06-26",
		AmountMilliunits: -10990000,
		PayeeName:        "Main Merchant",
		CategoryID:       "parent-category",
		Memo:             "Split payment",
		Splits: []SplitInput{
			{
				AmountMilliunits: -10000000,
				PayeeName:        "Main Merchant",
				CategoryID:       "primary-category",
				Memo:             "Primary charge",
			},
			{
				AmountMilliunits: -990000,
				PayeeName:        "Payment Processor",
				CategoryID:       "fee-category",
				Memo:             "Processing fee",
			},
		},
	})

	if tx.CategoryID != nil {
		t.Fatalf("split parent category = %q, want nil", *tx.CategoryID)
	}
	if len(tx.Subtransactions) != 2 {
		t.Fatalf("subtransactions length = %d, want 2", len(tx.Subtransactions))
	}
	if tx.Subtransactions[0] != (Subtransaction{
		Amount:     -10000000,
		PayeeName:  "Main Merchant",
		CategoryID: "primary-category",
		Memo:       "Primary charge",
	}) {
		t.Fatalf("first split = %#v", tx.Subtransactions[0])
	}
	if tx.Subtransactions[1] != (Subtransaction{
		Amount:     -990000,
		PayeeName:  "Payment Processor",
		CategoryID: "fee-category",
		Memo:       "Processing fee",
	}) {
		t.Fatalf("second split = %#v", tx.Subtransactions[1])
	}
	if tx.Memo != "Split payment; source=ynab-expense-cli" {
		t.Fatalf("parent memo = %q", tx.Memo)
	}
}

func TestBuildExpenseSplitImportIDIncludesSplitDetails(t *testing.T) {
	base := Input{
		AccountID:        "account-123",
		Date:             "2026-06-26",
		AmountMilliunits: -10990000,
		PayeeName:        "Main Merchant",
		Memo:             "Split payment",
		Splits: []SplitInput{
			{AmountMilliunits: -10000000, PayeeName: "Main Merchant", CategoryID: "primary-category", Memo: "Primary charge"},
			{AmountMilliunits: -990000, PayeeName: "Payment Processor", CategoryID: "fee-category", Memo: "Processing fee"},
		},
	}

	first := BuildExpense(base)
	second := BuildExpense(base)
	if first.ImportID != second.ImportID {
		t.Fatalf("identical split import IDs differ: %q vs %q", first.ImportID, second.ImportID)
	}

	changed := base
	changed.Splits = []SplitInput{
		{AmountMilliunits: -9900000, PayeeName: "Main Merchant", CategoryID: "primary-category", Memo: "Primary charge"},
		{AmountMilliunits: -1090000, PayeeName: "Payment Processor", CategoryID: "fee-category", Memo: "Processing fee"},
	}
	if BuildExpense(changed).ImportID == first.ImportID {
		t.Fatal("split import ID did not change after split allocation changed")
	}
}

func TestBuildExpenseWithoutSplitsKeepsSimplePayload(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID:        "account-123",
		Date:             "2026-06-20",
		AmountMilliunits: -6300000,
		PayeeName:        "Verduleria",
		CategoryID:       "category-123",
		Memo:             "Frutas",
	})

	if tx.CategoryID == nil || *tx.CategoryID != "category-123" {
		t.Fatalf("simple category = %#v, want category-123", tx.CategoryID)
	}
	if len(tx.Subtransactions) != 0 {
		t.Fatalf("simple transaction has splits: %#v", tx.Subtransactions)
	}
}
```

- [ ] **Step 2: Run transaction tests to verify they fail**

Run:

```bash
go test ./internal/transactions -count=1
```

Expected: FAIL with undefined `SplitInput`, `Subtransaction`, or `Subtransactions`.

- [ ] **Step 3: Extend transaction types and builder**

Update `internal/transactions/transaction.go` with these additions and replacements:

```go
type SplitInput struct {
	AmountMilliunits int64
	PayeeName        string
	CategoryID       string
	Memo             string
}

type Input struct {
	AccountID        string
	Date             string
	AmountMilliunits int64
	PayeeName        string
	CategoryID       string
	Memo             string
	Splits           []SplitInput
}

type Subtransaction struct {
	Amount     int64  `json:"amount"`
	PayeeName  string `json:"payee_name,omitempty"`
	CategoryID string `json:"category_id"`
	Memo       string `json:"memo,omitempty"`
}

type Transaction struct {
	AccountID       string           `json:"account_id"`
	Date            string           `json:"date"`
	Amount          int64            `json:"amount"`
	PayeeName       string           `json:"payee_name"`
	CategoryID      *string          `json:"category_id,omitempty"`
	Memo            string           `json:"memo"`
	Cleared         string           `json:"cleared"`
	Approved        bool             `json:"approved"`
	ImportID        string           `json:"import_id"`
	Subtransactions []Subtransaction `json:"subtransactions,omitempty"`
}
```

Replace `BuildExpense` with:

```go
func BuildExpense(input Input) Transaction {
	accountID := strings.TrimSpace(input.AccountID)
	date := strings.TrimSpace(input.Date)
	payeeName := strings.TrimSpace(input.PayeeName)
	categoryID := strings.TrimSpace(input.CategoryID)
	memo := AuditMemo(input.Memo)
	transaction := Transaction{
		AccountID: accountID,
		Date:      date,
		Amount:    input.AmountMilliunits,
		PayeeName: payeeName,
		Memo:      memo,
		Cleared:   "uncleared",
		Approved:  false,
	}

	if len(input.Splits) == 0 {
		if categoryID != "" {
			transaction.CategoryID = &categoryID
		}
	} else {
		transaction.Subtransactions = buildSubtransactions(input.Splits)
	}

	transaction.ImportID = StableImportID(accountID, date, input.AmountMilliunits, payeeName, memo, input.Splits)
	return transaction
}
```

Add helpers:

```go
func buildSubtransactions(inputs []SplitInput) []Subtransaction {
	splits := make([]Subtransaction, 0, len(inputs))
	for _, input := range inputs {
		splits = append(splits, Subtransaction{
			Amount:     input.AmountMilliunits,
			PayeeName:  strings.TrimSpace(input.PayeeName),
			CategoryID: strings.TrimSpace(input.CategoryID),
			Memo:       strings.TrimSpace(input.Memo),
		})
	}
	return splits
}
```

Change `StableImportID` to accept split details:

```go
func StableImportID(accountID string, date string, amount int64, payee string, memo string, splits []SplitInput) string {
	material := fmt.Sprintf(
		"%s|%s|%d|%s|%s|%s",
		accountID,
		date,
		amount,
		normalizeHashPart(payee),
		normalizeHashPart(memo),
		normalizeSplitsForHash(splits),
	)
	sum := sha256.Sum256([]byte(material))

	return fmt.Sprintf("YNABEXP:%X", sum)[:28]
}

func normalizeSplitsForHash(splits []SplitInput) string {
	if len(splits) == 0 {
		return ""
	}

	parts := make([]string, 0, len(splits))
	for _, split := range splits {
		parts = append(parts, fmt.Sprintf(
			"%d:%s:%s:%s",
			split.AmountMilliunits,
			normalizeHashPart(split.PayeeName),
			normalizeHashPart(split.CategoryID),
			normalizeHashPart(split.Memo),
		))
	}
	return strings.Join(parts, ";")
}
```

- [ ] **Step 4: Update existing import ID tests for the new signature**

Search for `StableImportID(` in `internal/transactions/transaction_test.go` and update direct calls to pass `nil` as the final argument.

Example:

```go
got := StableImportID("account-123", "2026-06-20", -6300000, "Verduleria", "Frutas", nil)
```

- [ ] **Step 5: Run transaction tests**

Run:

```bash
go test ./internal/transactions -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit transaction split payload support**

Run:

```bash
git add internal/transactions/transaction.go internal/transactions/transaction_test.go
git commit -m "feat(transactions): support split payloads"
```

---

### Task 2: File Input Parser

**Files:**
- Create: `internal/cli/add_file.go`
- Create: `internal/cli/add_file_test.go`

- [ ] **Step 1: Add failing parser tests**

Create `internal/cli/add_file_test.go`:

```go
package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadAddFileInputSimpleExpense(t *testing.T) {
	path := writeTempExpenseFile(t, `{
		"date": "2026-06-20",
		"amount": 6300,
		"currency": "CLP",
		"payee": "Verduleria",
		"category_id": "category-123",
		"memo": "Frutas"
	}`)

	got, err := loadAddFileInput(path)
	if err != nil {
		t.Fatalf("loadAddFileInput returned error: %v", err)
	}
	if got.Amount.String() != "6300" {
		t.Fatalf("amount = %q, want 6300", got.Amount.String())
	}
	if got.Payee != "Verduleria" || got.CategoryID != "category-123" {
		t.Fatalf("parsed input = %#v", got)
	}
}

func TestLoadAddFileInputSplitExpense(t *testing.T) {
	path := writeTempExpenseFile(t, `{
		"date": "2026-06-26",
		"amount": "10.990",
		"currency": "CLP",
		"payee": "Main Merchant",
		"memo": "Split payment",
		"splits": [
			{"amount": 10000, "payee": "Main Merchant", "category_id": "primary-category", "memo": "Primary charge"},
			{"amount": 990, "payee": "Payment Processor", "category_id": "fee-category", "memo": "Processing fee"}
		]
	}`)

	got, err := loadAddFileInput(path)
	if err != nil {
		t.Fatalf("loadAddFileInput returned error: %v", err)
	}
	if got.Amount.String() != "10.990" {
		t.Fatalf("parent amount = %q, want 10.990", got.Amount.String())
	}
	if len(got.Splits) != 2 {
		t.Fatalf("splits length = %d, want 2", len(got.Splits))
	}
	if got.Splits[1].Amount.String() != "990" {
		t.Fatalf("second split amount = %q, want 990", got.Splits[1].Amount.String())
	}
}

func TestLoadAddFileInputRejectsUnknownFields(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":"2026-06-20","amount":6300,"payee":"Store","category_id":"category-123","unexpected":true}`)

	_, err := loadAddFileInput(path)
	if err == nil {
		t.Fatal("loadAddFileInput accepted an unknown field")
	}
	if !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("expected unknown field error, got %q", err.Error())
	}
}

func TestLoadAddFileInputMalformedJSONIncludesPath(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":`)

	_, err := loadAddFileInput(path)
	if err == nil {
		t.Fatal("loadAddFileInput accepted malformed JSON")
	}
	if !strings.Contains(err.Error(), path) {
		t.Fatalf("expected error to include path %q, got %q", path, err.Error())
	}
}

func TestNormalizeAddFileInputValidatesSplitSum(t *testing.T) {
	input := addFileInput{
		Date:     "2026-06-26",
		Amount:   addFileAmount{raw: "10990"},
		Currency: "CLP",
		Payee:    "Main Merchant",
		Splits: []addFileSplit{
			{Amount: addFileAmount{raw: "10000"}, CategoryID: "primary-category"},
			{Amount: addFileAmount{raw: "990"}, CategoryID: "fee-category"},
		},
	}

	got, err := normalizeAddFileInput(input)
	if err != nil {
		t.Fatalf("normalizeAddFileInput returned error: %v", err)
	}
	if got.AmountMilliunits != -10990000 {
		t.Fatalf("parent milliunits = %d, want -10990000", got.AmountMilliunits)
	}
	if got.Splits[0].AmountMilliunits != -10000000 || got.Splits[1].AmountMilliunits != -990000 {
		t.Fatalf("split milliunits = %#v", got.Splits)
	}
}

func TestNormalizeAddFileInputRejectsSplitSumMismatch(t *testing.T) {
	input := addFileInput{
		Date:     "2026-06-26",
		Amount:   addFileAmount{raw: "10990"},
		Currency: "CLP",
		Payee:    "Main Merchant",
		Splits: []addFileSplit{
			{Amount: addFileAmount{raw: "10000"}, CategoryID: "primary-category"},
			{Amount: addFileAmount{raw: "900"}, CategoryID: "fee-category"},
		},
	}

	_, err := normalizeAddFileInput(input)
	if err == nil {
		t.Fatal("normalizeAddFileInput accepted mismatched split totals")
	}
	if !strings.Contains(err.Error(), "split amounts must sum to transaction amount") {
		t.Fatalf("expected split sum error, got %q", err.Error())
	}
}

func writeTempExpenseFile(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "expense.json")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	return path
}
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run:

```bash
go test ./internal/cli -run 'TestLoadAddFileInput|TestNormalizeAddFileInput' -count=1
```

Expected: FAIL because `loadAddFileInput`, `normalizeAddFileInput`, `addFileInput`, `addFileSplit`, and `addFileAmount` do not exist.

- [ ] **Step 3: Implement JSON file parsing**

Create `internal/cli/add_file.go`:

```go
package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

type addFileAmount struct {
	raw string
}

func (a addFileAmount) String() string {
	return a.raw
}

func (a *addFileAmount) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		a.raw = ""
		return nil
	}

	var text string
	if err := json.Unmarshal(trimmed, &text); err == nil {
		a.raw = strings.TrimSpace(text)
		return nil
	}

	var number json.Number
	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.UseNumber()
	if err := decoder.Decode(&number); err != nil {
		return fmt.Errorf("amount must be a string or number")
	}
	a.raw = number.String()
	return nil
}

type addFileInput struct {
	Budget     *string        `json:"budget"`
	AccountID  *string        `json:"account_id"`
	Amount     addFileAmount  `json:"amount"`
	Currency   string         `json:"currency"`
	Payee      string         `json:"payee"`
	Date       string         `json:"date"`
	CategoryID string         `json:"category_id"`
	Memo       string         `json:"memo"`
	Splits     []addFileSplit `json:"splits"`
}

type addFileSplit struct {
	Amount     addFileAmount `json:"amount"`
	Payee      string        `json:"payee"`
	CategoryID string        `json:"category_id"`
	Memo       string        `json:"memo"`
}

type normalizedAddFileInput struct {
	addInput
	AmountMilliunits int64
	Splits           []transactions.SplitInput
	ExplicitBudget   bool
	ExplicitAccount  bool
}

func loadAddFileInput(path string) (addFileInput, error) {
	cleanPath := strings.TrimSpace(path)
	if cleanPath == "" {
		return addFileInput{}, fmt.Errorf("--file is required")
	}

	data, err := os.ReadFile(cleanPath)
	if err != nil {
		return addFileInput{}, fmt.Errorf("read expense file %s: %w", cleanPath, err)
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var input addFileInput
	if err := decoder.Decode(&input); err != nil {
		return addFileInput{}, fmt.Errorf("parse expense file %s: %w", cleanPath, err)
	}
	var extra struct{}
	if err := decoder.Decode(&extra); err != io.EOF {
		return addFileInput{}, fmt.Errorf("parse expense file %s: multiple JSON values are not supported", cleanPath)
	}
	return input, nil
}

func normalizeAddFileInput(input addFileInput) (normalizedAddFileInput, error) {
	currency := strings.TrimSpace(input.Currency)
	if currency == "" {
		currency = "CLP"
	}

	base := addInput{
		Amount:     input.Amount.String(),
		Currency:   currency,
		Payee:      strings.TrimSpace(input.Payee),
		Date:       strings.TrimSpace(input.Date),
		CategoryID: strings.TrimSpace(input.CategoryID),
		Memo:       strings.TrimSpace(input.Memo),
	}
	explicitBudget := input.Budget != nil
	if explicitBudget {
		base.Budget = strings.TrimSpace(*input.Budget)
	}
	explicitAccount := input.AccountID != nil
	if explicitAccount {
		base.AccountID = strings.TrimSpace(*input.AccountID)
	}

	if base.Amount == "" {
		return normalizedAddFileInput{}, fmt.Errorf("--amount is required")
	}
	if base.Payee == "" {
		return normalizedAddFileInput{}, fmt.Errorf("--payee is required")
	}
	if base.Date == "" {
		return normalizedAddFileInput{}, fmt.Errorf("--date is required")
	}

	parentMilliunits, err := money.ParseExpenseMilliunits(base.Amount, base.Currency)
	if err != nil {
		return normalizedAddFileInput{}, err
	}

	if len(input.Splits) == 0 {
		if base.CategoryID == "" {
			return normalizedAddFileInput{}, fmt.Errorf("--category-id is required")
		}
		return normalizedAddFileInput{
			addInput:         base,
			AmountMilliunits: parentMilliunits,
			ExplicitBudget:   explicitBudget,
			ExplicitAccount:  explicitAccount,
		}, nil
	}

	if base.CategoryID != "" {
		return normalizedAddFileInput{}, fmt.Errorf("split transactions must set category_id on each split, not on the parent")
	}
	if len(input.Splits) < 2 {
		return normalizedAddFileInput{}, fmt.Errorf("split transactions require at least two split lines")
	}

	splits := make([]transactions.SplitInput, 0, len(input.Splits))
	var splitTotal int64
	for index, split := range input.Splits {
		amountText := split.Amount.String()
		if strings.TrimSpace(amountText) == "" {
			return normalizedAddFileInput{}, fmt.Errorf("split %d amount is required", index+1)
		}
		categoryID := strings.TrimSpace(split.CategoryID)
		if categoryID == "" {
			return normalizedAddFileInput{}, fmt.Errorf("split %d category_id is required", index+1)
		}

		milliunits, err := money.ParseExpenseMilliunits(amountText, base.Currency)
		if err != nil {
			return normalizedAddFileInput{}, fmt.Errorf("split %d: %w", index+1, err)
		}
		splitTotal += milliunits
		splits = append(splits, transactions.SplitInput{
			AmountMilliunits: milliunits,
			PayeeName:        strings.TrimSpace(split.Payee),
			CategoryID:       categoryID,
			Memo:             strings.TrimSpace(split.Memo),
		})
	}

	if splitTotal != parentMilliunits {
		return normalizedAddFileInput{}, fmt.Errorf("split amounts must sum to transaction amount: splits total %s, transaction amount %s", formatExpenseUnits(splitTotal, base.Currency), formatExpenseUnits(parentMilliunits, base.Currency))
	}

	return normalizedAddFileInput{
		addInput:         base,
		AmountMilliunits: parentMilliunits,
		Splits:           splits,
		ExplicitBudget:   explicitBudget,
		ExplicitAccount:  explicitAccount,
	}, nil
}

func formatExpenseUnits(milliunits int64, currency string) string {
	units := -milliunits / 1000
	return fmt.Sprintf("%d %s", units, strings.ToUpper(strings.TrimSpace(currency)))
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
go test ./internal/cli -run 'TestLoadAddFileInput|TestNormalizeAddFileInput' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit file parser**

Run:

```bash
git add internal/cli/add_file.go internal/cli/add_file_test.go
git commit -m "feat(cli): parse add file input"
```

---

### Task 3: Add Command File Flow

**Files:**
- Modify: `internal/cli/add.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing Cobra tests for `add --file`**

Append these tests near the other add command tests in `internal/cli/cli_test.go`:

```go
func TestAddFileDryRunUsesDefaultsAndIncludesSplits(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-26",
		"amount": 10990,
		"currency": "CLP",
		"payee": "Main Merchant",
		"memo": "Split payment",
		"splits": [
			{"amount": 10000, "payee": "Main Merchant", "category_id": "primary-category", "memo": "Primary charge"},
			{"amount": 990, "payee": "Payment Processor", "category_id": "fee-category", "memo": "Processing fee"}
		]
	}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{
			DefaultBudgetID:  "budget-config",
			DefaultAccountID: "account-config",
		}),
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd, "add", "--file", path, "--dry-run")

	if err != nil {
		t.Fatalf("add --file dry-run returned error: %v", err)
	}
	output := out.String()
	for _, want := range []string{
		`"budget": "budget-config"`,
		`"account_id": "account-config"`,
		`"amount": -10990000`,
		`"subtransactions"`,
		`"category_id": "primary-category"`,
		`"category_id": "fee-category"`,
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("add --file dry-run output missing %s, got %q", want, output)
		}
	}
}

func TestAddFileExplicitBudgetAndAccountOverrideDefaults(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"budget": "budget-file",
		"account_id": "account-file",
		"date": "2026-06-20",
		"amount": 6300,
		"payee": "Store",
		"category_id": "category-file"
	}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{
			DefaultBudgetID:  "budget-config",
			DefaultAccountID: "account-config",
		}),
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd, "add", "--file", path, "--dry-run")

	if err != nil {
		t.Fatalf("add --file dry-run returned error: %v", err)
	}
	output := out.String()
	for _, want := range []string{`"budget": "budget-file"`, `"account_id": "account-file"`} {
		if !strings.Contains(output, want) {
			t.Fatalf("add --file output missing %s, got %q", want, output)
		}
	}
}

func TestAddFileRejectsDetailFlags(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"date": "2026-06-20",
		"amount": 6300,
		"payee": "Store",
		"category_id": "category-file"
	}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{})

	err := executeCommand(cmd, "add", "--file", path, "--amount", "6300")

	if err == nil {
		t.Fatal("add --file accepted a detail flag")
	}
	if !strings.Contains(err.Error(), "--file cannot be combined with transaction detail flags") {
		t.Fatalf("expected mixed input error, got %q", err.Error())
	}
}

func TestAddFileExplicitBlankBudgetDoesNotUseConfigDefault(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"budget": "",
		"date": "2026-06-20",
		"amount": 6300,
		"payee": "Store",
		"category_id": "category-file"
	}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{
			DefaultBudgetID:  "budget-config",
			DefaultAccountID: "account-config",
		}),
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd, "add", "--file", path, "--dry-run")

	if err == nil {
		t.Fatal("add --file accepted an explicit blank budget")
	}
	if !strings.Contains(err.Error(), "--budget is required") {
		t.Fatalf("expected budget required error, got %q", err.Error())
	}
}

func TestAddFileExplicitBlankAccountDoesNotUseConfigDefault(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"account_id": "",
		"date": "2026-06-20",
		"amount": 6300,
		"payee": "Store",
		"category_id": "category-file"
	}`)
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{
			DefaultBudgetID:  "budget-config",
			DefaultAccountID: "account-config",
		}),
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(cmd, "add", "--file", path, "--dry-run")

	if err == nil {
		t.Fatal("add --file accepted an explicit blank account")
	}
	if !strings.Contains(err.Error(), "--account-id is required") {
		t.Fatalf("expected account required error, got %q", err.Error())
	}
}

func TestAddFileCommitSendsSplitTransaction(t *testing.T) {
	var out bytes.Buffer
	path := writeCLIExpenseFile(t, `{
		"budget": "budget-file",
		"account_id": "account-file",
		"date": "2026-06-26",
		"amount": 10990,
		"payee": "Main Merchant",
		"splits": [
			{"amount": 10000, "category_id": "primary-category"},
			{"amount": 990, "category_id": "fee-category"}
		]
	}`)
	client := &fakeYNABClient{createTransactionResponse: []byte(`{"data":{"transaction":{"id":"tx-123"}}}`)}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			return client
		},
	})

	err := executeCommand(cmd, "add", "--file", path, "--commit")

	if err != nil {
		t.Fatalf("add --file --commit returned error: %v", err)
	}
	if client.createTransactionBudget != "budget-file" {
		t.Fatalf("budget = %q, want budget-file", client.createTransactionBudget)
	}
	if len(client.createTransactionPayload.Transaction.Subtransactions) != 2 {
		t.Fatalf("subtransactions = %#v", client.createTransactionPayload.Transaction.Subtransactions)
	}
}

func writeCLIExpenseFile(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "expense.json")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	return path
}
```

Also add imports to `internal/cli/cli_test.go` if missing:

```go
import (
	"os"
	"path/filepath"
)
```

- [ ] **Step 2: Run new CLI tests to verify they fail**

Run:

```bash
go test ./internal/cli -run 'TestAddFile' -count=1
```

Expected: FAIL because `--file` is not registered and the add command does not route file input.

- [ ] **Step 3: Add `--file` flag and mixed-input validation**

Modify `internal/cli/add.go`.

Add local variable:

```go
var filePath string
```

Register the flag:

```go
cmd.Flags().StringVar(&filePath, "file", "", "Read expense input from a JSON file")
```

Add this helper near `resolveAccountID`:

```go
func addDetailFlagsChanged(cmd *cobra.Command) []string {
	names := []string{"budget", "account-id", "amount", "currency", "payee", "date", "category-id", "memo"}
	changed := make([]string, 0, len(names))
	for _, name := range names {
		if cmd.Flags().Changed(name) {
			changed = append(changed, "--"+name)
		}
	}
	return changed
}
```

- [ ] **Step 4: Route file input in `RunE`**

In `RunE`, before building the current flag-based `rawInput`, add:

```go
if strings.TrimSpace(filePath) != "" {
	if changed := addDetailFlagsChanged(cmd); len(changed) > 0 {
		return fmt.Errorf("--file cannot be combined with transaction detail flags: %s", strings.Join(changed, ", "))
	}

	fileInput, err := loadAddFileInput(filePath)
	if err != nil {
		return err
	}
	normalized, err := normalizeAddFileInput(fileInput)
	if err != nil {
		return err
	}

	resolvedBudget, err := a.resolveBudgetFromValue(cmd, normalized.Budget, normalized.ExplicitBudget)
	if err != nil {
		return err
	}
	normalized.Budget = resolvedBudget

	resolvedAccountID, err := a.resolveAccountIDFromValue(normalized.AccountID, normalized.ExplicitAccount)
	if err != nil {
		return err
	}
	normalized.AccountID = resolvedAccountID

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

	return a.writeOrCommitAddPayload(cmd, commit, input.Budget, payload)
}
```

Extract the existing dry-run/commit block into:

```go
func (a *App) writeOrCommitAddPayload(cmd *cobra.Command, commit bool, budget string, payload transactions.PostTransactionRequest) error {
	if !commit {
		body, err := json.MarshalIndent(struct {
			DryRun  bool                                `json:"dry_run"`
			Budget  string                              `json:"budget"`
			Payload transactions.PostTransactionRequest `json:"payload"`
		}{
			DryRun:  true,
			Budget:  budget,
			Payload: payload,
		}, "", "  ")
		if err != nil {
			return err
		}
		return a.writeJSON(body)
	}

	client, err := a.clientForCommand(cmd)
	if err != nil {
		return err
	}

	body, err := client.CreateTransaction(cmd.Context(), budget, payload)
	if err != nil {
		return err
	}
	return a.writeJSON(body)
}
```

Then replace the existing flag-flow dry-run/commit code with:

```go
return a.writeOrCommitAddPayload(cmd, commit, input.Budget, payload)
```

- [ ] **Step 5: Add explicit-value budget/account resolvers**

Modify `internal/cli/list.go` and `internal/cli/add.go` to avoid relying only on Cobra flag state for file input.

In `internal/cli/list.go`, replace `resolveBudget` body with a wrapper:

```go
func (a *App) resolveBudget(cmd *cobra.Command, budget string) (string, error) {
	return a.resolveBudgetFromValue(cmd, budget, cmd.Flags().Changed("budget"))
}

func (a *App) resolveBudgetFromValue(cmd *cobra.Command, budget string, explicit bool) (string, error) {
	if explicit {
		budget = strings.TrimSpace(budget)
		if budget == "" {
			return "", fmt.Errorf("--budget is required")
		}
		return budget, nil
	}

	cfg, err := a.loadConfig()
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(cfg.DefaultBudgetID) != "" {
		return strings.TrimSpace(cfg.DefaultBudgetID), nil
	}

	budget = strings.TrimSpace(budget)
	if budget == "" {
		return "", fmt.Errorf("--budget is required")
	}
	return budget, nil
}
```

In `internal/cli/add.go`, replace `resolveAccountID` with:

```go
func (a *App) resolveAccountID(cmd *cobra.Command, accountID string) (string, error) {
	return a.resolveAccountIDFromValue(accountID, cmd.Flags().Changed("account-id"))
}

func (a *App) resolveAccountIDFromValue(accountID string, explicit bool) (string, error) {
	if explicit {
		return accountID, nil
	}

	cfg, err := a.loadConfig()
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(cfg.DefaultAccountID) != "" {
		return strings.TrimSpace(cfg.DefaultAccountID), nil
	}
	return accountID, nil
}
```

- [ ] **Step 6: Run `add --file` tests**

Run:

```bash
go test ./internal/cli -run 'TestAddFile' -count=1
```

Expected: PASS.

- [ ] **Step 7: Run full CLI tests**

Run:

```bash
go test ./internal/cli -count=1
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

Run:

```bash
go test ./... -count=1
```

Expected: PASS.

- [ ] **Step 9: Commit add file flow**

Run:

```bash
git add internal/cli/add.go internal/cli/list.go internal/cli/cli_test.go
git commit -m "feat(cli): support add file input"
```

---

### Task 4: Documentation and Smoke Examples

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with `add --file` examples**

In `README.md`, under `## Add Expenses`, add a subsection after the existing flag-based dry-run example:

````markdown
You can also keep an expense in a local JSON file and pass it with `--file`.

Simple expense file:

```json
{
  "date": "2026-06-20",
  "amount": 6300,
  "currency": "CLP",
  "payee": "Store",
  "category_id": "category-id",
  "memo": "Groceries"
}
```

Preview it:

```sh
ynab-expense add --file simple-expense.json --dry-run
```

Split expense file:

```json
{
  "date": "2026-06-26",
  "amount": 10990,
  "currency": "CLP",
  "payee": "Main Merchant",
  "memo": "Split payment example",
  "splits": [
    {
      "amount": 10000,
      "payee": "Main Merchant",
      "category_id": "primary-category-id",
      "memo": "Primary charge"
    },
    {
      "amount": 990,
      "payee": "Payment Processor",
      "category_id": "fee-category-id",
      "memo": "Processing fee"
    }
  ]
}
```

Preview it:

```sh
ynab-expense add --file split-expense.json --dry-run
```

Only `--commit` writes the file-based expense to YNAB. Keep personal expense JSON files out of git.
````

- [ ] **Step 2: Add a safety note**

In `## Safety Notes`, add:

```markdown
- `add --file` supports simple and split expenses, but still does not write without `--commit`.
- Personal expense JSON files can contain account, category, and merchant details; keep them out of git.
```

- [ ] **Step 3: Run full tests and build**

Run:

```bash
go test ./... -count=1
go build -o ynab-expense ./cmd/ynab-expense
rm -f ./ynab-expense
```

Expected: both test and build commands pass, and no generated binary remains.

- [ ] **Step 4: Run smoke commands with temporary files**

Create temporary smoke files outside the repo:

```bash
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"; rm -f ./ynab-expense' EXIT
go build -o ynab-expense ./cmd/ynab-expense
cat > "$tmp_dir/simple-expense.json" <<'JSON'
{
  "date": "2026-06-20",
  "amount": 6300,
  "currency": "CLP",
  "payee": "Store",
  "category_id": "category-id",
  "memo": "Groceries"
}
JSON
cat > "$tmp_dir/split-expense.json" <<'JSON'
{
  "date": "2026-06-26",
  "amount": 10990,
  "currency": "CLP",
  "payee": "Main Merchant",
  "memo": "Split payment example",
  "splits": [
    {"amount": 10000, "payee": "Main Merchant", "category_id": "primary-category-id", "memo": "Primary charge"},
    {"amount": 990, "payee": "Payment Processor", "category_id": "fee-category-id", "memo": "Processing fee"}
  ]
}
JSON
./ynab-expense add --file "$tmp_dir/simple-expense.json" --dry-run
./ynab-expense add --file "$tmp_dir/split-expense.json" --dry-run
```

Expected:

- Simple dry-run prints `"category_id": "category-id"`.
- Split dry-run prints `"subtransactions"`.
- Split dry-run prints `"category_id": "primary-category-id"`.
- Split dry-run prints `"category_id": "fee-category-id"`.
- No live YNAB write occurs because `--commit` is omitted.

- [ ] **Step 5: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs(splits): document add file input"
```

---

## Final Review Checklist

- [ ] `go test ./... -count=1` passes.
- [ ] `go build -o ynab-expense ./cmd/ynab-expense` passes.
- [ ] Existing flag-based `add` still works.
- [ ] `add --file simple.json --dry-run` works.
- [ ] `add --file split.json --dry-run` shows `subtransactions`.
- [ ] `add --file split-expense.json --dry-run` does not resolve tokens or call live YNAB.
- [ ] `add --file split-expense.json --commit` is the only file-based write path.
- [ ] Split amounts must sum to the parent amount.
- [ ] Parent `category_id` is omitted for split payloads.
- [ ] README uses placeholder IDs and does not include private transaction data.
- [ ] No private files under `local-notes/` or generated JSON examples are committed.
