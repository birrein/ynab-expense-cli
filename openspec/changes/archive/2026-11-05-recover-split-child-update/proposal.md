## Why
A direct update of an Actual split child reset its amount and category and changed the account balance. Prevent recurrence and restore the affected transaction from its verified pre-write backup.

## What Changes
- Disable direct split-child note amendments.
- Add a narrowly validated, backup-based recovery for an interrupted child note update using the parent transaction API.
- Verify every transaction, balance, and budget metadata independently after synchronization.

## Capabilities
### New Capabilities
- `actual-split-recovery`: Recover an exact audited split-child update incident.
### Modified Capabilities
- `actual-owned-split-child-note`: Disable unsafe direct child writes.

## Impact
Actual CLI adapter and tests. Recovery requires an owned run, write lock, pre-incident backup and fresh backup.
