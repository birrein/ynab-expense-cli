## Why

Cross-budget debt transfers record a durable pending audit before either write, but unrelated adapter mutations are not currently blocked if a transfer is left partially applied. Further writes could complicate recovery and reconciliation.

## What Changes

- Block all financial mutation entrypoints while any cross-currency debt transfer is pending.
- Preserve read-only inspection and lease closure without advancing incomplete windows.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-evidenced-cross-currency-debt-transfer`: extend pending-state protection across unrelated financial writers.

## Impact

Actual adapter mutation guards, tests and runbook; no changes to existing transfers or external services.
