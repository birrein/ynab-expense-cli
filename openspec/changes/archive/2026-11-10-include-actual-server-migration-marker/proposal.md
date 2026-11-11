## Why

An Actual server backup with its account database but without its matching migration marker cannot be restarted: the server replays migrations against an already migrated database. The migration rehearsal exposed this gap.

## What Changes

- Include the server data directory's `.migrate` file in every new daily and monthly backup and its integrity manifest.
- Fail closed if the marker is missing or invalid; retain the existing lease, lock, non-destructive and budget-selection rules.
- Document the restore dependency and verify it with regression tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-safe-daily-backup`: Require a valid server migration marker in new backups.

## Impact

`scripts/actual-backup.mjs`, its tests, the backup runbook, and the backup manifest. No financial writes or budget version changes.
