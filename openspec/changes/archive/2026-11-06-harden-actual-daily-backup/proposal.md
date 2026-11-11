## Why

The scheduled backup uses a stale global API and fails after budget migrations. Its automatic retention can also delete transaction backups referenced by the reconciliation ledger before independent cloud verification.

## What Changes

- Use the project's existing compatible Actual API runtime for scheduled exports.
- Fail closed if a financial run or lock remains active, retain prior backups, and disable destructive automatic rotation pending a separate verified retention workflow.
- Clean only temporary clients created by the current backup, including when it fails.

## Capabilities

### New Capabilities

- `actual-safe-daily-backup`: Compatible, non-destructive scheduled exports and safe handling of active reconciliation and temporary clients.

### Modified Capabilities

None.

## Impact

Scheduled local backup script, tests and runbook. Existing budgets, server version, schedule and reconciliation ledger remain unchanged.
