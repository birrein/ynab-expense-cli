## Purpose

Create compatible and non-destructive daily backups of the active Actual budgets and reconciliation state, while preserving audit evidence.

## ADDED Requirements

### Requirement: Compatible and non-destructive daily backup

The scheduled backup SHALL use the project's existing compatible Actual API by default, preserve the test override, export active CLP and USD budgets and state, and SHALL NOT automatically delete prior local or cloud backups, snapshots or other runs' clients. It SHALL clean only clients created by its own invocation, including after failure. It SHALL refuse to overwrite an existing destination when forced and SHALL NOT change budget data.

#### Scenario: Successful new daily backup
- **WHEN** the reconciliation is idle and no current daily backup exists
- **THEN** the operation exports both active budgets and the state and retains all prior backups and evidence.

#### Scenario: Failed export or forced existing backup
- **WHEN** an export fails or force targets an existing backup
- **THEN** the operation reports failure, preserves existing backups and removes only its own temporary clients.

### Requirement: Fail closed while reconciliation is active

The backup SHALL wait for the lease and write lock to clear and MUST abort without producing or pruning backups if they remain active at the deadline.
The backup SHALL acquire the adapter's shared write lock atomically, recheck the lease after acquisition, and hold the lock until its work and temporary-client cleanup finish.

#### Scenario: Busy deadline reached
- **WHEN** the write lock or active run persists throughout the allowed wait
- **THEN** the operation fails without exporting or deleting any data.
