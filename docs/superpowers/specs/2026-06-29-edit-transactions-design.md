# ynab-expense edit transactions design

Date: 2026-06-29

## Goal

Add a safe `edit` command to `ynab-expense` so existing YNAB transactions can be corrected from the CLI without hand-written API calls.

The feature should support routine corrections from the email-to-YNAB workflow, including category, memo, payee, account, date, and amount changes. It should also support replacing split transactions by creating a corrected transaction and deleting the original, because the YNAB API does not support updating existing split lines.

## Non-Goals

- Do not add an interactive editor in this iteration.
- Do not add category or account lookup by name in this iteration; edits use IDs.
- Do not update or create `import_id` values for existing transactions.
- Do not support editing existing split lines through YNAB's transaction update endpoint.
- Do not add a general-purpose wrapper for every YNAB transaction field.
- Do not store personal transaction examples in tracked repository files.
- Do not change token storage, authentication behavior, or local config paths.
- Do not change the existing `add` command behavior.

## API Constraints

YNAB exposes two relevant write paths:

- `PATCH /plans/{plan_id}/transactions` updates one or more existing transactions by `id` or `import_id`.
- `DELETE /plans/{plan_id}/transactions/{transaction_id}` deletes a transaction.

The editable transaction schema includes optional fields such as `account_id`, `date`, `amount`, `payee_id`, `payee_name`, `category_id`, `memo`, `cleared`, `approved`, `flag_color`, and `subtransactions`.

However, the OpenAPI description for `subtransactions` says updating `subtransactions` on an existing split transaction is not supported. For this CLI, split line edits must therefore use a replacement workflow:

1. Read the original transaction.
2. Build a corrected split transaction from a JSON file.
3. Create the corrected transaction.
4. Delete the original transaction only after the replacement is created successfully.

## User Experience

### Simple Transaction Edits

`edit` is dry-run by default:

```sh
ynab-expense edit \
  --id transaction-id \
  --memo "Uber One" \
  --category-id monthly-subscriptions-category-id
```

Commit writes the update:

```sh
ynab-expense edit \
  --id transaction-id \
  --amount 3990 \
  --date 2026-06-27 \
  --memo "Uber One" \
  --commit
```

The command supports explicit dry-run for readability:

```sh
ynab-expense edit \
  --id transaction-id \
  --account-id corrected-account-id \
  --dry-run
```

`--dry-run` and `--commit` are mutually exclusive.

Unlike `add`, `edit` dry-run requires a YNAB token because it must read the current transaction before showing the preview.

### Supported Simple Edit Flags

The MVP supports these fields:

- `--account-id`
- `--date`
- `--amount`
- `--currency`
- `--payee`
- `--category-id`
- `--memo`
- `--cleared`
- `--approved`

`--amount` uses the same user-facing parsing rules as `add`: users pass a positive expense amount, and the CLI sends the negative YNAB milliunit amount.

Examples:

```text
--amount 3990 --currency CLP => -3990000
--amount 12.99 --currency USD => -12990
```

`--currency` only matters when `--amount` is present. If `--amount` is omitted, `--currency` must not be sent and should not affect the update.

`--cleared` accepts YNAB cleared statuses:

```text
cleared
uncleared
reconciled
```

`--approved` accepts Go boolean flag forms supported by Cobra, such as:

```sh
--approved=true
--approved=false
```

### Split Transaction Replacement

Split corrections follow the current `add --file` convention:

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

`--replace-split` requires `--file`. `--file` without `--replace-split` is rejected in this iteration.

The file format is the same as `add --file` split input:

```json
{
  "date": "2026-06-28",
  "amount": 46570,
  "currency": "CLP",
  "payee": "MercadoLibre",
  "memo": "Compra #2000013744201473",
  "splits": [
    {
      "amount": 33400,
      "payee": "MercadoLibre",
      "category_id": "groceries-category-id",
      "memo": "Café Lavazza 27900; Sazonador Umami Ajinomoto 5500"
    },
    {
      "amount": 13170,
      "payee": "MercadoLibre",
      "category_id": "household-cleaning-category-id",
      "memo": "Tabletas lavavajillas 9990; Dr. Beckmann limpia lavadoras 3180"
    }
  ]
}
```

For replacement files:

- `splits` is required and must contain at least two lines.
- Split amounts must sum to the parent amount after currency parsing.
- Each split line requires `amount` and `category_id`.
- If `budget` is omitted, use normal budget resolution: explicit `--budget`, local config, then `default`.
- If `account_id` is omitted, use the original transaction's `account_id`, not the configured default account.
- If `date`, `amount`, or `payee` is omitted, return the same validation errors as `add --file`.
- If the original transaction is not a split, `--replace-split` is still allowed as an explicit conversion to a split, because the operation is create-and-delete rather than in-place editing.

## Output Design

### Simple Dry-Run Output

Dry-run prints JSON with the current transaction and the patch payload:

```json
{
  "dry_run": true,
  "budget": "budget-id",
  "operation": "edit",
  "transaction_id": "transaction-id",
  "before": {
    "id": "transaction-id",
    "date": "2026-06-27",
    "amount": -3990000,
    "payee_name": "Uber",
    "category_id": "transportation-category-id",
    "memo": "Banco de Chile aviso compra 27/06/2026 21:47"
  },
  "patch": {
    "id": "transaction-id",
    "category_id": "monthly-subscriptions-category-id",
    "memo": "Uber One"
  }
}
```

The output should include the fields returned by YNAB for `before` without trying to reformat the whole response. It is acceptable to preserve the raw transaction object as `before`.

The `patch` object must include only fields that will be sent to YNAB plus the transaction `id`. This keeps the preview focused and avoids implying that unchanged fields are being resent.

### Simple Commit Output

Commit sends:

```json
{
  "transactions": [
    {
      "id": "transaction-id",
      "category_id": "monthly-subscriptions-category-id",
      "memo": "Uber One"
    }
  ]
}
```

The CLI prints the raw YNAB response body, matching existing list and add commands.

### Replace-Split Dry-Run Output

Dry-run prints JSON describing the replacement plan:

```json
{
  "dry_run": true,
  "budget": "budget-id",
  "operation": "replace_split",
  "warning": "commit will create a replacement transaction and delete the original transaction",
  "original_transaction_id": "transaction-id",
  "original": {},
  "replacement_payload": {
    "transaction": {}
  }
}
```

The replacement payload should be exactly the create payload that would be sent to YNAB.

### Replace-Split Commit Output

Commit must create the replacement first and delete the original second.

If both operations succeed, print a JSON object that includes:

- `operation: "replace_split"`
- `deleted_transaction_id`
- `created_transaction_id`
- `created_transaction`
- `delete_response`

If replacement creation fails, return the create error and do not delete the original transaction.

If replacement creation succeeds but deletion fails, return an error that includes the created replacement transaction id and the original transaction id. This state must be visible because manual cleanup may be required.

## Validation Rules

Required for all edit modes:

- `--id` is required and must not be blank.
- `--budget` follows existing budget resolution behavior.
- `--dry-run` and `--commit` cannot be used together.

Required for simple edit:

- At least one edit field must be present.
- `--file` must not be present.
- `--replace-split` must not be present.
- `--currency` without `--amount` is rejected.
- `--date`, when present, must be `YYYY-MM-DD`.
- `--amount`, when present, must parse using the existing money package.
- `--account-id`, `--payee`, `--category-id`, `--memo`, and `--cleared`, when explicitly provided, are trimmed.
- Explicit blank values for required API fields are rejected before token resolution where possible.

Required for replace-split:

- `--file` and `--replace-split` must both be present.
- Simple edit flags cannot be combined with `--file`: `--account-id`, `--date`, `--amount`, `--currency`, `--payee`, `--category-id`, `--memo`, `--cleared`, and `--approved`.
- `--budget` may be combined with `--file` because it identifies the budget used to read the original transaction.
- The replacement file must validate through the same split rules as `add --file`.
- The replacement payload must not use the default account when the file omits `account_id`; it must inherit the original transaction account.

## Package Design

### `internal/transactions`

Add edit-specific payload types instead of reusing the create transaction type directly:

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
```

Use pointer fields for values where an explicit zero or empty-compatible API value may matter:

- `Amount`
- `CategoryID`
- `Memo`
- `Approved`

The first MVP does not support clearing a category or memo to null from the CLI. Pointers are still useful for distinguishing omitted values from explicit values in tests and JSON output.

Add a builder such as:

```go
type PatchInput struct {
	ID         string
	AccountID  string
	Date       string
	Amount     *int64
	PayeeName  string
	CategoryID *string
	Memo       *string
	Cleared    string
	Approved   *bool
}

func BuildPatch(input PatchInput) PatchTransaction
```

`BuildPatch` should trim string fields and include only non-empty or explicitly present fields.

Do not append `source=ynab-expense-cli` to edit memos. Edits should preserve the exact memo the user asks for, because the main workflow is correcting existing transactions.

### `internal/ynab`

Add client methods:

```go
func (c *Client) GetTransaction(ctx context.Context, budget string, transactionID string) ([]byte, error)
func (c *Client) PatchTransactions(ctx context.Context, budget string, payload transactions.PatchTransactionsRequest) ([]byte, error)
func (c *Client) DeleteTransaction(ctx context.Context, budget string, transactionID string) ([]byte, error)
```

Paths:

```text
GET /plans/{plan_id}/transactions/{transaction_id}
PATCH /plans/{plan_id}/transactions
DELETE /plans/{plan_id}/transactions/{transaction_id}
```

Escape both plan and transaction path segments.

### `internal/cli`

Add `internal/cli/edit.go` with:

- flag parsing
- validation
- read-before-write
- dry-run output
- commit behavior
- replacement orchestration

Extend `ynabClient` in `internal/cli/root.go` with:

```go
GetTransaction(context.Context, string, string) ([]byte, error)
PatchTransactions(context.Context, string, transactions.PatchTransactionsRequest) ([]byte, error)
DeleteTransaction(context.Context, string, string) ([]byte, error)
```

Reuse existing helpers where practical:

- `resolveBudget`
- `clientForCommand`
- `writeJSON`
- `money.ParseExpenseMilliunits`
- `loadAddFileInput`
- `normalizeAddFileInput`
- split validation from add-file logic

If the current add-file helpers are too coupled to `add`, extract shared file-normalization helpers only as needed. Keep the refactor limited to supporting this feature.

## Existing Transaction Parsing

The CLI needs the original transaction's account id and split status.

Parse the `GET /transactions/{transaction_id}` response into a small local struct:

```go
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

Also preserve the raw transaction JSON for dry-run output so the preview remains faithful to YNAB's current state.

## Error Handling

Expected errors:

- Missing token: reuse the existing missing-token message.
- Blank `--id`: `--id is required`.
- No edit fields: `at least one edit field is required`.
- `--currency` without `--amount`: `--currency requires --amount`.
- Invalid date: `--date must be YYYY-MM-DD`.
- Invalid cleared status: `--cleared must be one of: cleared, uncleared, reconciled`.
- `--file` without `--replace-split`: `--file requires --replace-split`.
- `--replace-split` without `--file`: `--replace-split requires --file`.
- Detail flags with `--file`: mirror the existing add-file conflict style.
- Original transaction response missing `account_id` when replacement file omits `account_id`: return a clear error rather than guessing.

## Testing

Unit tests should cover:

- `edit` rejects missing `--id`.
- `edit` rejects no edit fields.
- `edit` rejects `--dry-run` with `--commit`.
- `edit` rejects `--currency` without `--amount`.
- `edit` validates `--date`.
- `edit` validates `--cleared`.
- `edit` dry-run requires token because it reads YNAB.
- `edit` uses configured default budget when `--budget` is omitted.
- `edit` explicit `--budget` overrides configured default.
- `edit --memo --category-id` reads the current transaction and prints `before` plus the patch payload.
- `edit --amount 3990 --currency CLP` sends `amount: -3990000`.
- `edit --approved=false` includes `approved: false` in the patch payload.
- `edit --commit` sends `PATCH /plans/{plan_id}/transactions` and prints the YNAB response.
- `edit --file` without `--replace-split` errors.
- `edit --replace-split` without `--file` errors.
- `edit --file --replace-split --dry-run` reads the original transaction and prints replacement payload.
- `edit --file --replace-split` inherits the original transaction account when JSON omits `account_id`.
- `edit --file --replace-split --commit` creates the replacement before deleting the original.
- If replacement creation fails, delete is not called.
- If deletion fails after successful replacement creation, the error includes both transaction IDs.
- YNAB client tests cover `GET`, `PATCH`, and `DELETE` paths, methods, escaping, auth header, and JSON payloads.

## Documentation

Update `README.md` with:

- `edit` command examples.
- The read-before-write dry-run behavior.
- A note that edit dry-run requires a token.
- Supported simple edit fields.
- The split replacement flow and its create-then-delete behavior.
- A warning that `replace-split` can leave both transactions present if deletion fails after replacement creation.

Update this spec only if implementation discovers a documented API constraint that changes the design.

## Verification

Before implementation is considered complete:

```sh
go test ./... -count=1
go build -o ynab-expense ./cmd/ynab-expense
```

The edit dry-run and commit flows should be covered by automated tests with fake clients. A private real-transaction smoke test is optional and should only be run after manual review. Do not commit real transaction IDs, account IDs, category IDs, or generated private fixture files.
