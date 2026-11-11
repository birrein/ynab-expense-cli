## Why

Statements can contain many distinct daily interest credits with equal amounts close together. Existing conservative duplicate detection prevents recording them even when each bank line has an independent reference and all nearby transactions are already verified.

## What Changes

- Add a narrowly evidenced exception for distinct income lines with complete conflict coverage, exact snapshots, separate bank references and independently verified statement evidence.
- Keep all source, account, category, backup, lease, synchronization and readback protections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-confirmed-cashflows`: Allow distinct statement-backed income lines with equal amounts and nearby dates under strict source and ledger verification.

## Impact

Cashflow candidate validation, its tests, and the runbook. No bank operations or unverified balance adjustments.
