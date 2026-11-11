## Why

Some imported reciprocal transfers debit the wrong own account even though both bank statements and the transfer receipt identify the true origin. The existing adapter can change a destination but cannot correct this case safely.

## What Changes

- Add a narrowly scoped audited operation that moves the existing origin leg to an independently evidenced account, preserving both transaction IDs and all unrelated data.
- Require exact prior snapshots, two distinct bank statements, a receipt, duplicate checks, an exclusive lease, backup, pending audit and independent full readback.
- Keep incomplete attempts blocked pending investigation, and make completed retries read-only.

## Capabilities

### New Capabilities
- `actual-historical-transfer-origin`: Correct the origin account of an existing reciprocal historical transfer with corroborating statement evidence.

### Modified Capabilities

## Impact

Actual adapter, its unit and integration tests, runbook and user-authorized reconciliation; no direct database changes or payment initiation.
