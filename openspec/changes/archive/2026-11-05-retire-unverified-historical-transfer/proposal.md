## Why

Historical transfers can conflict with both bank statements and distort two account balances. Correcting these records requires an auditable, tightly scoped operation that preserves the rest of the budget.

## What Changes

- Add a guarded operation to retire an exact pair of historical transfer legs when both account statements establish that the recorded transfer did not occur.
- Require preview, statement provenance, backup, synchronization, independent read-back and recovery without duplicate writes.
- Reject source-linked, reconciled, scheduled or ambiguous transfers and preserve unrelated transactions.

## Capabilities

### New Capabilities

- `actual-historical-transfer-retirement`: Verified retirement of an unsupported historical transfer pair with independent bank evidence.

### Modified Capabilities

None.

## Impact

Actual Go CLI forwards a new candidate to the Node adapter. The adapter, tests and operational runbook change; no bank or budget configuration changes.
