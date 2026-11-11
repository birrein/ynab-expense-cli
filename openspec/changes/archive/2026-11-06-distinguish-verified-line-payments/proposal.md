## Why
A bank can show distinct line repayments of the same amount on consecutive dates; the duplicate check blocks the second even when the first is already independently verified.

## What Changes
- Accept a narrowly evidenced second line repayment when the sole match is a fully verified earlier pair backed by the same statement.
- Preserve exact prior transactions and all financial safety checks.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `actual-confirmed-cashflows`: distinguish one verified earlier line repayment from a different dated statement row.

## Impact
Cashflow classification, tests, runbook and spec. No new dependencies or direct database writes.
