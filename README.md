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
  --budget-id e8038248-d795-488d-93a1-2aadc4edb98d \
  --budget-name "Default budget" \
  --account-id 93e8e6dc-b70a-46ad-8c0a-63de83f50acf \
  --account-name "BCH Crédito CLP 7481"
```

The config file lives at:

```text
~/.config/ynab-expense/config.json
```

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
