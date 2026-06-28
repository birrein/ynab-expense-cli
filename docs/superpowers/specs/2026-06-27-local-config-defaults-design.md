# ynab-expense local config defaults design

Date: 2026-06-27

## Goal

Add local user configuration so daily expense entry can omit the repeated YNAB budget and account IDs.

The feature should keep personal YNAB metadata out of the repository, preserve the current safe write behavior, and make the config file readable enough to inspect manually.

## Non-Goals

- Do not store YNAB API tokens in the config file. Token storage stays in macOS Keychain with `YNAB_API_TOKEN` as the environment fallback.
- Do not add default category support in this iteration.
- Do not add default currency support in this iteration. `add` already defaults to `CLP`.
- Do not implement interactive selection from live YNAB budgets/accounts in this iteration.
- Do not change the `--commit` safety rule.

## User Experience

Add a new `config` command group:

```text
ynab-expense config show
ynab-expense config set-defaults
```

`config set-defaults` accepts one or both default values:

```sh
ynab-expense config set-defaults \
  --budget-id e8038248-d795-488d-93a1-2aadc4edb98d \
  --budget-name "Default budget"

ynab-expense config set-defaults \
  --account-id 93e8e6dc-b70a-46ad-8c0a-63de83f50acf \
  --account-name "BCH Crédito CLP 7481"

ynab-expense config set-defaults \
  --budget-id e8038248-d795-488d-93a1-2aadc4edb98d \
  --budget-name "Default budget" \
  --account-id 93e8e6dc-b70a-46ad-8c0a-63de83f50acf \
  --account-name "BCH Crédito CLP 7481"
```

Names are optional metadata. IDs are the values used by the CLI.

After defaults are configured, these commands should work without repeating the budget:

```sh
ynab-expense accounts
ynab-expense categories
ynab-expense transactions --since 2026-06-01
```

`add` should use both defaults when present:

```sh
ynab-expense add \
  --amount 6300 \
  --payee "Feria" \
  --date 2026-06-20 \
  --category-id aaaf94f8-8817-4306-afcd-0f4a1248b322 \
  --dry-run
```

Explicit flags always win over config values:

```sh
ynab-expense add \
  --budget other-budget-id \
  --account-id other-account-id \
  --amount 6300 \
  --payee "Feria" \
  --date 2026-06-20 \
  --dry-run
```

## Config File

Store config at:

```text
~/.config/ynab-expense/config.json
```

Use JSON to avoid a new parser dependency. Preserve readability with descriptive fields:

```json
{
  "default_budget_id": "e8038248-d795-488d-93a1-2aadc4edb98d",
  "default_budget_name": "Default budget",
  "default_account_id": "93e8e6dc-b70a-46ad-8c0a-63de83f50acf",
  "default_account_name": "BCH Crédito CLP 7481"
}
```

The CLI uses only the `*_id` fields for API calls. The `*_name` fields are informational for humans and for `config show`.

## Package Design

Add `internal/config` for local config file handling.

Responsibilities:

- Resolve the default config path from `os.UserConfigDir()` plus `ynab-expense/config.json`.
- Load a missing file as an empty config.
- Return a clear error for malformed JSON, including the config path.
- Save JSON using indentation and create parent directories when needed.
- Merge partial updates without deleting existing defaults.

Proposed struct:

```go
type Config struct {
	DefaultBudgetID    string `json:"default_budget_id,omitempty"`
	DefaultBudgetName  string `json:"default_budget_name,omitempty"`
	DefaultAccountID   string `json:"default_account_id,omitempty"`
	DefaultAccountName string `json:"default_account_name,omitempty"`
}
```

The CLI layer should depend on a small config store interface so tests can inject fake config data without touching the real home directory.

## CLI Integration

Add `internal/cli/config.go` with:

```text
config
config show
config set-defaults
```

`config show` prints pretty JSON. If the file does not exist, it prints an empty JSON object:

```json
{}
```

`config set-defaults`:

- Fails if neither `--budget-id` nor `--account-id` is provided.
- Trims all flag values.
- Saves only provided fields, preserving unprovided existing fields.
- Allows names to be provided only when their related ID is present or already configured.

Integrate config resolution into list commands:

- `accounts`
- `categories`
- `transactions`

Resolution order for budget:

1. Explicit `--budget`
2. `default_budget_id` from config
3. Existing fallback value `default`

Integrate config resolution into `add`:

Budget resolution:

1. Explicit `--budget`
2. `default_budget_id` from config
3. Existing fallback value `default`

Account resolution:

1. Explicit `--account-id`
2. `default_account_id` from config
3. Error: `--account-id is required`

Dry-run must still avoid token and live YNAB calls.

## Error Handling

Expected behavior:

- Missing config file: treat as empty config.
- Malformed config file: return an error with the file path.
- Unwritable config directory or file: return the underlying write error with path context.
- `config set-defaults` without any ID: return `at least one default value is required`.
- `add` without explicit or configured account: return the existing `--account-id is required` style error.

## Testing

Unit tests should cover:

- Missing config loads as empty.
- Malformed config returns a path-aware error.
- Saving creates parent directories.
- Partial config update preserves existing values.
- `config show` prints `{}` for missing config.
- `config set-defaults` writes budget and account metadata.
- `config set-defaults` can set only budget or only account.
- `config set-defaults` rejects calls with no IDs.
- List commands use configured `default_budget_id` when `--budget` is omitted.
- Explicit `--budget` overrides configured `default_budget_id`.
- `add` uses configured `default_budget_id` and `default_account_id`.
- Explicit `--budget` and `--account-id` override configured defaults.
- `add --dry-run` with configured defaults still does not resolve tokens or call YNAB.

## Documentation

Update `README.md` with:

- Config file location.
- `config show`.
- `config set-defaults` examples.
- Examples of `accounts`, `categories`, `transactions`, and `add --dry-run` without repeated budget/account flags.
- Clarification that explicit flags override local defaults.

Update the original MVP design document only if needed to point to this follow-up spec. Do not rewrite MVP history.

## Verification

Before implementation is considered complete:

```sh
go test ./...
go build -o ynab-expense ./cmd/ynab-expense
./ynab-expense config show
./ynab-expense config set-defaults --budget-id e8038248-d795-488d-93a1-2aadc4edb98d --budget-name "Default budget"
./ynab-expense config set-defaults --account-id 93e8e6dc-b70a-46ad-8c0a-63de83f50acf --account-name "BCH Crédito CLP 7481"
./ynab-expense add --amount 6300 --payee "Feria" --date 2026-06-20 --category-id aaaf94f8-8817-4306-afcd-0f4a1248b322 --dry-run
```

The final smoke commands may use a temporary config directory in tests or manual verification to avoid modifying the user's real config until the user chooses to set it.
