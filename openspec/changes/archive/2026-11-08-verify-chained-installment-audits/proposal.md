## Why

Completed installment corrections currently require the original target and neighbor snapshots to remain unchanged on retry, so later separately audited corrections can cause false conflicts and prevent reliable verification.

## What Changes

- Verify completed installment amount and date corrections through exact, chronologically subsequent completed amount/date audit transitions for the target and neighbors.
- Restrict the new behavior to read-only retries of an exact completed candidate; preserve strict current snapshot matching for new writes.
- Reject unverified transitions, changed fields, ambiguous histories and incomplete audit chains.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-expense-amount`: Verify a completed installment amount correction after later audited amount or date changes.
- `actual-historical-installment-date`: Verify a completed installment date correction after later audited amount or date changes.

## Impact

Historical correction classifiers, a shared audit-lineage verifier, tests, runbook and capability specifications. No financial write is performed merely by verifying prior corrections.
