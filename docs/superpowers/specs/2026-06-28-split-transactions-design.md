# ynab-expense split transactions design

Date: 2026-06-28

## Goal

Add split transaction support to `ynab-expense` so one card charge can be divided across multiple YNAB categories and payees.

The feature should make split entry safe to preview, easy to reproduce from a saved file, and consistent with the existing simple expense flow.

## Non-Goals

- Do not add an interactive split editor in this iteration.
- Do not add category lookup by name in this iteration; split lines use category IDs.
- Do not store personal transaction examples in tracked repository files.
- Do not change token storage or authentication behavior.
- Do not change the `--commit` safety rule.
- Do not add transaction update/edit support in this iteration.

## User Experience

Keep the current quick flag-based flow for simple expenses:

```sh
ynab-expense add \
  --amount 6300 \
  --payee "Verduleria de la esquina" \
  --date 2026-06-20 \
  --category-id groceries-category-id \
  --memo "Frutas y verduras" \
  --dry-run
```

Add a unified file-based flow for both simple and split expenses:

```sh
ynab-expense add --file expense.json --dry-run
ynab-expense add --file expense.json --commit
```

The `--file` path may be relative to the current working directory or absolute. The file is local-only and is not stored by the CLI.

`--file` can be combined with:

- `--dry-run`
- `--commit`

`--file` cannot be combined with transaction detail flags:

- `--budget`
- `--account-id`
- `--amount`
- `--currency`
- `--payee`
- `--date`
- `--category-id`
- `--memo`

Budget and account defaults should work the same as the flag flow:

1. Explicit values from the JSON file.
2. Local config defaults.
3. Existing budget fallback of `default`, where applicable.
4. Missing account still errors with the existing `--account-id is required` style.

## JSON Format

### Simple Expense

```json
{
  "date": "2026-06-20",
  "amount": 6300,
  "currency": "CLP",
  "payee": "Verduleria de la esquina",
  "category_id": "groceries-category-id",
  "memo": "Frutas y verduras"
}
```

### Split Expense

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

Optional top-level fields:

- `budget`
- `account_id`
- `currency`
- `category_id`
- `memo`
- `splits`

Required top-level fields:

- `date`
- `amount`
- `payee`

Required for simple expenses:

- `category_id`

Required for each split line:

- `amount`
- `category_id`

Optional for each split line:

- `payee`
- `memo`

If a split line omits `payee`, YNAB should inherit or display the parent payee according to API behavior. The CLI should not synthesize a split-line payee unless the user provided one.

## Amount Rules

Amounts in JSON are positive expense amounts, matching the current flag UX.

The CLI converts them to negative YNAB milliunits internally:

- Parent `amount: 10990` with `currency: "CLP"` becomes `-10990000`.
- Split `amount: 10000` with `currency: "CLP"` becomes `-10000000`.
- Split `amount: 990` with `currency: "CLP"` becomes `-990000`.

All split amounts use the parent transaction currency. Per-split currency is outside this iteration.

If `splits` is present:

- It must contain at least two lines.
- The sum of split amounts must equal the parent amount after parsing.
- The parent transaction must not send `category_id`.
- Each split line must send its own `category_id`.

If `splits` is absent or empty:

- The transaction is a simple expense.
- The parent transaction must send `category_id`.

## Payload Design

Extend the transactions package to represent subtransactions:

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

`transactions.BuildExpense` should remain the single builder for simple and split expenses. It should:

- Preserve existing simple transaction behavior when `Splits` is empty.
- Attach `subtransactions` when `Splits` is non-empty.
- Omit parent `category_id` when `Splits` is non-empty.
- Preserve the audit marker `source=ynab-expense-cli` in the parent memo.
- Leave split memos as user-provided values without appending the audit marker to each line.

Stable `import_id` remains on the parent transaction. Its hash should include account ID, date, total amount, parent payee, parent memo, and normalized split details. That reduces duplicate writes while distinguishing different split allocations for the same merchant/amount/date.

## CLI Design

`internal/cli/add.go` should support two input sources:

1. Existing flags.
2. New JSON file via `--file`.

Only one source may provide transaction detail fields. If `--file` is set and any transaction detail flag is also set, return a clear error such as:

```text
--file cannot be combined with transaction detail flags
```

`--dry-run` remains optional because dry-run is still the default. `--commit` is still the only write path.

Dry-run output should continue to include:

```json
{
  "dry_run": true,
  "budget": "budget-id",
  "payload": {
    "transaction": {}
  }
}
```

For split expenses, the payload in dry-run should show `subtransactions` exactly as they would be sent to YNAB.

## File Parsing

Add a small JSON file input type, likely near the CLI layer because it represents command UX:

```go
type addFileInput struct {
	Budget     string           `json:"budget"`
	AccountID  string           `json:"account_id"`
	Amount     stringOrNumber   `json:"amount"`
	Currency   string           `json:"currency"`
	Payee      string           `json:"payee"`
	Date       string           `json:"date"`
	CategoryID string           `json:"category_id"`
	Memo       string           `json:"memo"`
	Splits     []addFileSplit   `json:"splits"`
}

type addFileSplit struct {
	Amount     stringOrNumber `json:"amount"`
	Payee      string         `json:"payee"`
	CategoryID string         `json:"category_id"`
	Memo       string         `json:"memo"`
}
```

The amount field should accept JSON numbers and strings. This keeps files ergonomic for CLP values like `10990` while preserving compatibility with current amount parsing rules like `"12.990"` or `"$12.990"`.

The parser should reject unknown fields. Typos in financial input files should fail loudly instead of being ignored.

## Validation

Validation should happen before token resolution and before live YNAB calls.

Expected validation errors:

- Missing file path after `--file`.
- Unreadable file path includes the path in the error.
- Malformed JSON includes the path in the error.
- Unknown JSON field identifies the field when feasible.
- `--file` combined with detail flags errors.
- Missing `date`, `amount`, or `payee` errors.
- Simple file input without `category_id` errors.
- Split file input with parent `category_id` errors, because split categories belong on lines.
- Split file input with fewer than two lines errors.
- Split line without `amount` errors.
- Split line without `category_id` errors.
- Split amount sum mismatch errors with expected and actual totals.
- Explicit blank `budget` or `account_id` in JSON is treated like an explicit blank flag and errors rather than falling back to config.

## Error Handling

All file and validation errors should be local and should not require a token.

Malformed file example:

```text
parse expense file /path/to/expense.json: unexpected end of JSON input
```

Split mismatch example:

```text
split amounts must sum to transaction amount: splits total 10900 CLP, transaction amount 10990 CLP
```

YNAB API errors should continue to use the existing API error path.

## Testing

Unit and CLI tests should cover:

- Existing flag-based simple add still works.
- `add --file simple.json --dry-run` builds the same payload shape as flags.
- `add --file split.json --dry-run` includes `subtransactions`.
- `add --file split.json --dry-run` uses local default budget and account when omitted.
- `add --file split.json --dry-run` with explicit JSON budget/account overrides local defaults.
- `add --file split.json --dry-run` does not resolve token or call live YNAB.
- `add --file split.json --commit` sends the split payload to the fake YNAB client.
- `--file` cannot be combined with detail flags.
- Unknown JSON fields are rejected.
- Missing required fields are rejected.
- Simple JSON without `category_id` is rejected.
- Split JSON with parent `category_id` is rejected.
- Split JSON with fewer than two split lines is rejected.
- Split line missing `amount` or `category_id` is rejected.
- Split sum mismatch is rejected.
- Stable import IDs differ when split allocation changes.
- Stable import IDs are identical for identical split input.

The existing pending private payment can be used as a manual smoke case from `local-notes/` after split support is implemented. Do not commit the private file or its real IDs into tracked docs.

## Documentation

Update `README.md` with:

- `ynab-expense add --file expense.json --dry-run`.
- Simple JSON example with placeholder IDs.
- Split JSON example with placeholder IDs.
- Explanation that flags remain available for quick simple expenses.
- Explanation that `--commit` is still required to write.
- Explanation that split amounts must sum to the parent amount.
- Warning not to commit personal expense JSON files.

## Verification

Before implementation is considered complete:

```sh
go test ./... -count=1
go build -o ynab-expense ./cmd/ynab-expense
```

Manual smoke with temporary files:

```sh
./ynab-expense add --file simple-expense.example.json --dry-run
./ynab-expense add --file split-expense.example.json --dry-run
```

Final real-write smoke should use a private local file and should still go through dry-run review before `--commit`.
