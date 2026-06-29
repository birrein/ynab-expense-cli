# ynab-expense

`ynab-expense` is a local Go CLI for quickly previewing and adding expense transactions to YNAB. It is not an official YNAB CLI.

The CLI uses the official YNAB API base URL:

```text
https://api.ynab.com/v1
```

## Install

Install from this repository:

```sh
go install ./cmd/ynab-expense
```

Or build a local binary:

```sh
go build -o ynab-expense ./cmd/ynab-expense
```

## Authentication

Store a YNAB Personal Access Token in macOS Keychain:

```sh
ynab-expense auth set-token
```

The command prompts securely and does not echo the token.

For automation, pass the token through stdin:

```sh
printf '%s\n' "$YNAB_API_TOKEN" | ynab-expense auth set-token --token-stdin
```

Token lookup precedence:

1. `YNAB_API_TOKEN` environment variable
2. macOS Keychain

Check whether a token is configured:

```sh
ynab-expense auth status
```

`auth status` reports the token source only. It never prints the token value.

## Local Defaults

You can store local default IDs outside the repository:

```sh
ynab-expense config set-defaults \
  --budget-id budget-id \
  --budget-name "Default budget" \
  --account-id account-id \
  --account-name "Credit card"
```

The config file lives at:

```text
~/.config/ynab-expense/config.json
```

If `XDG_CONFIG_HOME` is set, the CLI uses `$XDG_CONFIG_HOME/ynab-expense/config.json`.

Show the current config:

```sh
ynab-expense config show
```

Explicit command flags always override local defaults.

## Listing Data

List budgets:

```sh
ynab-expense budgets
```

List accounts in the configured default budget:

```sh
ynab-expense accounts
```

List categories in the configured default budget:

```sh
ynab-expense categories
```

List transactions since a date:

```sh
ynab-expense transactions --since 2026-06-01
```

## Add Expenses

`add` is dry-run by default. It prints the request payload and does not write to YNAB unless `--commit` is present.

When local defaults are configured, `add` can omit `--budget` and `--account-id`:

```sh
ynab-expense add \
  --amount 12.990 \
  --currency CLP \
  --payee "Comercio" \
  --date 2026-06-05 \
  --dry-run
```

Pass explicit flags when you want to override local defaults:

```sh
ynab-expense add \
  --budget default \
  --account-id account-1 \
  --amount 12.990 \
  --currency CLP \
  --payee "Comercio" \
  --date 2026-06-05 \
  --dry-run
```

You can also keep an expense in a local JSON file and pass it with `--file`.

Simple expense file:

```json
{
  "budget": "budget-id",
  "account_id": "account-id",
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
  "budget": "budget-id",
  "account_id": "account-id",
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
File input can omit `budget` and `account_id` only when local defaults are configured.

Write the expense only when you pass `--commit`:

```sh
ynab-expense add \
  --budget default \
  --account-id account-1 \
  --amount 12.990 \
  --currency CLP \
  --payee "Comercio" \
  --date 2026-06-05 \
  --commit
```

Only `--commit` writes to YNAB.

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

## Amount Parsing

YNAB stores amounts in milliunits. This MVP supports expense amounts in CLP and USD. CLP is the default currency.

CLP examples:

| Input | Milliunits |
| --- | ---: |
| `$12.990` | `-12990000` |
| `12.990` | `-12990000` |
| `12990` | `-12990000` |

USD examples:

| Input | Milliunits |
| --- | ---: |
| `$12.99` | `-12990` |
| `12.99` | `-12990` |
| `12990` | `-12990000` |

For USD, `12990` is interpreted as 12,990 dollars, not 12.99 dollars.

## Safety Notes

- Tokens are never printed by CLI status or save commands.
- Tokens are not accepted through argv; use the secure prompt or `--token-stdin`.
- `add` does not write without `--commit`.
- `add --file` supports simple and split expenses, but still does not write without `--commit`.
- Personal expense JSON files can contain account, category, and merchant details; keep them out of git.
- Generated `import_id` values are stable for retries to reduce duplicate transactions.
- New transactions are `uncleared`, unapproved, and include `source=ynab-expense-cli` in the memo.
- This MVP only supports expenses. It does not support inflows.

## Development

Run tests:

```sh
go test ./...
```

Build the binary:

```sh
go build -o ynab-expense ./cmd/ynab-expense
```

Show CLI help:

```sh
./ynab-expense --help
```

Verify dry-run examples:

```sh
./ynab-expense add --budget default --account-id account-1 --amount 12.990 --currency CLP --payee "Comercio" --date 2026-06-05 --dry-run
./ynab-expense add --budget default --account-id account-1 --amount 12.99 --currency USD --payee "Store" --date 2026-06-05 --dry-run
```

### TODOs

- [ ] Add a transaction update/edit command for existing expenses, including changing category and memo after creation.
- [ ] Evaluate whether the project architecture should evolve to support more features as the CLI grows.

### Technical Debt

- [ ] Keychain token storage currently drives `/usr/bin/security` prompts through a pseudo-terminal to avoid passing tokens through process arguments. Future hardening should evaluate a maintained Go Keychain library or expect-style PTY library.
