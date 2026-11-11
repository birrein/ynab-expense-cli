## Why

A historical expense estimate and a bank-backed charge can represent the same purchase even when the old note has an erroneous detail and the local amounts differ slightly. An explicit user confirmation, receipt and complete statement can identify the duplicate without inventing missing data in old notes.

## What Changes

- Add a narrow, evidence-gated mode to retire a simple historical duplicate with an independently verified receipt, statement and explicit user confirmation.
- Require exact snapshots, same account, date, payee and resolved category, close whole-peso amounts, documented item identity and a verified bank source.
- Preserve backup, exact audit, lease, locking, independent verification and safe retries.

## Capabilities

### New Capabilities
- `actual-user-confirmed-receipt-expense-deduplication`: Safely retire a user-confirmed historical duplicate of a bank-backed receipt purchase.

### Modified Capabilities

None.

## Impact

Actual duplicate-expense adapter, tests and operating runbook. No change to budgets until independently planned and applied.
