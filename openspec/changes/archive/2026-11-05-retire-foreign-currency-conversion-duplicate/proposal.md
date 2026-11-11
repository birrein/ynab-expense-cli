## Why

Historical records may use an estimated local conversion for a foreign-currency subscription while the bank-backed charge uses the final amount. Keeping both inflates the ledger; matching local amounts cannot identify this case safely.

## What Changes

- Add a narrow, evidence-backed mode for retiring a historical duplicate with a different local amount.
- Require the same account, day, payee, category and foreign-currency amount in both notes, exact snapshots, a retained bank ledger record and statement reference.
- Preserve backups, complete audit, lease, lock and independent verification of every unrelated record and the exact balance impact.

## Capabilities

### New Capabilities
- `actual-fx-historical-expense-deduplication`: retire a proven historical duplicate with an estimated foreign exchange conversion.

### Modified Capabilities

## Impact

Actual duplicate-expense adapter, tests and runbook; no budget write without an independently inspected statement and a matching plan.
