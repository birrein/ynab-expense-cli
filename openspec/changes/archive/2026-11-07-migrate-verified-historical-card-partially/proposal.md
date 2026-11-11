## Why

An independently checked historical card account overlaps a principal account's opening balance, while a small set of disputed rows still requires investigation. Keeping all history separate makes the principal account incomplete, but an unsafe merge could destroy exceptions, break transfers or invalidate an existing audit.

## What Changes

- Add a narrowly scoped, preview-bound partial historical account migration that preserves excluded records and all reciprocal transfers.
- Preserve the original line-payment audit and verify its exact historical snapshots through a migration-bound mapping after integration.
- Guard the full batch with an exclusive lease, backup, durable pending audit, fail-closed interruption handling and independent full-budget verification.

## Capabilities

### New Capabilities

- `actual-partial-historical-account-migration`: audited partial integration of historical transactions into a matching principal account.

### Modified Capabilities

- `actual-confirmed-cashflows`: preserve existing line-payment evidence across an exact verified migration.

## Impact

Actual daily adapter, historical transfer validation, tests, runbook and migration specification. Historical exceptions remain in the original open account; no automatic account closure.
