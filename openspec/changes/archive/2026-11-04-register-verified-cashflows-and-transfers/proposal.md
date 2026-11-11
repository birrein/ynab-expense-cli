## Why
The Actual daily adapter cannot post confirmed account income or create native linked same-currency transfers, leaving bank movements unreconciled.

## What Changes
- Add guarded statement-backed income and own-account transfer operations to the existing Actual CLI adapter.
- Preserve sources, duplicate checks, exclusive lease, backup and independently verified paired balances.

## Capabilities

### New Capabilities
- `actual-confirmed-cashflows`: Statement-backed income and linked same-currency own-account transfers.

### Modified Capabilities

## Impact
Existing Node Actual adapter, private ledger and same-currency Actual budgets; no other financial writer or bank transaction.
