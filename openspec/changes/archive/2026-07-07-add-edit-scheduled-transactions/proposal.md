## Why

Future-dated expenses cannot be created through the normal YNAB transaction endpoint, which blocks safe CLI handling for installment purchases and other planned expenses. The local CLI already supports safe preview-first normal transaction creation and editing, so scheduled transactions should use YNAB's dedicated scheduled transaction resource instead of ad hoc curl calls.

## What Changes

- Add CLI support for creating scheduled expense transactions through YNAB's scheduled transaction endpoint.
- Add CLI support for obtaining scheduled transactions through the same noun-style listing convention used by regular transactions.
- Add CLI support for editing existing scheduled transactions after reading the current scheduled transaction from YNAB.
- Preserve the existing write safety model: dry-run by default, explicit `--commit` for writes, and `--dry-run`/`--commit` mutual exclusion.
- Reuse existing budget/account default resolution, amount parsing, and memo audit marker conventions where they apply.
- Keep normal `add` and `edit` transaction commands on the normal transaction endpoints.
- Reject scheduled split creation/edit input in this change because YNAB does not support creating split scheduled transactions through the save model.

## Capabilities

### New Capabilities
- `scheduled-transactions`: Obtain scheduled transactions and create/edit single-category scheduled expense transactions from the CLI using YNAB's scheduled transaction API.

### Modified Capabilities
- None.

## Impact

- CLI: add a scheduled-transaction command surface for listing, previewing, committing, and editing scheduled expenses.
- YNAB client: add scheduled transaction list, get, create, and update methods using `GET`, `POST`, and `PUT` under `/plans/{plan_id}/scheduled_transactions`.
- Domain models: add scheduled transaction request payloads, response parsing helpers, date-next filtering, frequency validation, and merge logic for edit previews/commits.
- Tests/docs: cover scheduled retrieval, dry-run safety, commit payloads, date/frequency validation, default resolution, raw response output, and README usage examples.
