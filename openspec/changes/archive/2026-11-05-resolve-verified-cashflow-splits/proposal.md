## Why
An already verified bank-sourced expense can remain uncategorized until an itemized receipt is found. The existing cashflow operation cannot resolve that transaction to a categorized split while maintaining its ledger identity.

## What Changes
- Add a narrowly scoped operation that resolves an existing verified, uncategorized cashflow into an evidenced category split.
- Preserve its transaction ID, bank imported ID, Gmail and Drive provenance, and existing ledger/audit history; require plan, backup, lock, sync, and independent verification.

## Capabilities
### New Capabilities
- `actual-verified-cashflow-split-resolution`: Resolve a verified cashflow into an evidenced split without recreating the expense.
### Modified Capabilities
None.

## Impact
Actual daily adapter, verified cashflow ledger, tests, and reconciliation workflow.
