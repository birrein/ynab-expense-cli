# ynab-expense CLI design

Date: 2026-06-05

## Goal

Build a local macOS CLI named `ynab-expense` for registering and querying YNAB expenses through the official YNAB API.

The MVP must be small, secure, installable as a single Go binary, and easy to extend later for email parsing, receipt/OCR workflows, and analytical questions.

## Design Direction

Use a minimal Standard Go Project Layout with pragmatic package boundaries:

```text
cmd/ynab-expense/main.go
internal/cli/
internal/auth/
internal/ynab/
internal/money/
internal/transactions/
docs/
README.md
go.mod
```

This is not formal Clean Architecture or full Hexagonal Architecture. It uses the useful parts of both: pure logic stays away from Cobra, HTTP, and Keychain; external systems are isolated behind small package boundaries.

## Dependencies

Use Cobra for the CLI command tree, help output, and flag handling.

Use Go standard library packages for HTTP, JSON, dates, hashing, and process execution.

Do not add a Go Keychain dependency in the MVP. On macOS, store tokens by invoking `/usr/bin/security`.

## Package Responsibilities

`cmd/ynab-expense` only starts the command.

`internal/cli` owns Cobra commands, flags, user-facing output, command validation, and translating CLI options into package calls.

`internal/auth` owns token lookup and storage. Token lookup order is:

1. `YNAB_API_TOKEN`
2. macOS Keychain generic password

`auth set-token [token]` stores a Personal Access Token in Keychain. If the token argument is omitted, prompt for it without echoing input. `auth status` reports whether a token is available and where it would be read from, without printing the token.

`internal/ynab` owns the HTTP client for `https://api.ynab.com/v1`, JSON request/response handling, and readable API errors. The base URL must be configurable for tests.

`internal/money` owns amount parsing and conversion to YNAB milliunits. MVP amount inputs include `12.990`, `$12.990`, and `12990`, which all represent a CLP expense of 12,990 and become `-12990000` milliunits when used by `add`. The MVP `add` command only creates expenses, so parsed amounts are stored as negative milliunits. Inflows are outside the MVP.

`internal/transactions` owns building safe transaction payloads, including defaults and stable `import_id` generation.

## Commands

Implement these MVP commands:

```text
ynab-expense auth set-token
ynab-expense auth status
ynab-expense budgets
ynab-expense accounts --budget default
ynab-expense categories --budget default
ynab-expense transactions --budget default --since YYYY-MM-DD
ynab-expense add --budget default --account-id ... --amount 12.990 --payee "Comercio" --date YYYY-MM-DD --dry-run
ynab-expense add ... --commit
```

The public command uses `--budget` because that is the user's expected vocabulary. Internally, the YNAB API path uses `plans`, including `default` when default plan selection is available.

For `transactions`, support `--since` and `--until`. If `--since` is omitted, rely on the current YNAB API default of one year.

## Write Safety

`ynab-expense add` is dry-run by default. The explicit `--dry-run` flag is accepted for clarity and conflicts with `--commit`. Dry-run prints the request payload and does not require a token unless `--commit` is present.

Only `--commit` sends `POST /plans/{plan_id}/transactions`.

New transactions default to:

```json
{
  "cleared": "uncleared",
  "approved": false,
  "memo": "source=ynab-expense-cli"
}
```

If a user supplies a memo, preserve the source audit marker. The exact memo strategy is:

- no memo: `source=ynab-expense-cli`
- custom memo: `<custom memo>; source=ynab-expense-cli`

## Import ID

Generate a deterministic `import_id` for each transaction attempt to deduplicate retries.

The value must be at most 36 characters because the YNAB OpenAPI schema limits `import_id` to `maxLength: 36`.

The MVP format is:

```text
YNABEXP:<20 hex sha256 chars>
```

Hash material:

```text
account_id|date|amount_milliunits|normalized_payee|normalized_memo
```

The hash excludes `category_id` so a retry after category correction is more likely to identify the same real-world transaction. The memo used in the hash is the final memo after adding the audit marker.

## API Coverage

Use the official YNAB API base URL:

```text
https://api.ynab.com/v1
```

MVP endpoints:

- `GET /plans`
- `GET /plans/{plan_id}/accounts`
- `GET /plans/{plan_id}/categories`
- `GET /plans/{plan_id}/transactions`
- `POST /plans/{plan_id}/transactions`

HTTP requests use Bearer auth. API errors should include HTTP status, YNAB error name, and YNAB detail when available. Tokens must never be printed.

## Output

For MVP, commands print pretty JSON by default. This keeps the implementation small and preserves complete YNAB data for local inspection.

Dry-run output includes:

```json
{
  "dry_run": true,
  "budget": "default",
  "payload": {
    "transaction": {}
  }
}
```

## Testing

Use TDD for implementation.

Unit tests must cover:

- CLP amount parsing to milliunits
- transaction payload defaults
- memo audit marker behavior
- stable `import_id`
- token source precedence
- Keychain command construction through a fake runner
- YNAB HTTP request paths, auth header behavior, success responses, and error responses
- Cobra command behavior for dry-run and commit

Integration-like tests should use `httptest.Server`, not the live YNAB API.

## Installability

The README must document:

- `go install` or local `go build`
- `ynab-expense auth set-token`
- `YNAB_API_TOKEN` fallback
- listing budgets/accounts/categories/transactions
- dry-run add
- committed add
- safety expectations around `--commit`

The repo should verify with:

```text
go test ./...
go build ./cmd/ynab-expense
```

## Non-MVP

Do not implement email parsing, OCR, receipt photos, daily automations, or analytical natural-language questions in this cycle.
