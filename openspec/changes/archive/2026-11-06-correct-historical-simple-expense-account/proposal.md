## Why

Historical expenses sometimes identify the wrong card. Bank notices and full statements can establish the correct card, but the existing account correction only supports splits.

## What Changes

- Add an evidence-gated correction for simple historical expenses across two active accounts in the same budget.
- Preserve transaction identity and all fields apart from account; reject conflicts, duplicates, and unverifiable retries.
- Preview, back up, record pending audit, synchronize, and independently verify both account balances and unrelated data.

## Capabilities

### New Capabilities
- `actual-historical-simple-expense-account`: Safely correct the account of a bank-evidenced historical simple expense.

### Modified Capabilities

None.

## Impact

Actual daily adapter, validation, tests, operational runbook, and OpenSpec; no changes to other budgets or remote configuration.
