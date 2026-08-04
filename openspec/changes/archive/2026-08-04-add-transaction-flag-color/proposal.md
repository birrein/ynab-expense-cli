## Why

Normal transaction behavior predates OpenSpec in this project, so its stable public contract is not yet represented by a canonical capability. At the same time, installment purchases need a consistent way to apply YNAB's `cuotas` flag to normal and scheduled rows instead of requiring manual correction after reconciliation.

## What Changes

- Introduce a `transactions` capability that baselines the existing public behavior for listing, creating, editing, and safely replacing normal transactions.
- Add a `--flag-color` option to normal transaction creation and editing.
- Add a `--flag-color` option to scheduled transaction creation and editing.
- Preserve the flag color during scheduled edit payload merges and include it in normal transaction patches.
- Keep the existing dry-run-first and explicit `--commit` write model.
- Document the flag in the CLI README and verify the payload behavior with tests.

## Capabilities

### New Capabilities

- `transactions`: Define the existing public contract for normal transaction listing, creation, editing, split handling, and optional flag colors.

### Modified Capabilities

- `scheduled-transactions`: Allow scheduled transaction create/edit operations to set and preserve `flag_color`.

## Impact

- CLI flags and help output for `add`, `edit`, `scheduled add`, and `scheduled edit`.
- YNAB normal transaction PATCH payloads and scheduled transaction POST/PUT payloads.
- Canonical OpenSpec coverage for normal transaction behavior that already exists in the CLI.
- Transaction and scheduled-transaction domain models, tests, and README documentation.
- No changes to account/category resolution, amount parsing, installment dates, or existing transactions unless the user explicitly edits them.
