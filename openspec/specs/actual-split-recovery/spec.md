# actual-split-recovery Specification

## Purpose
Recover an audited split transaction after an identified child-update incident while preserving all unrelated budget state.

## Requirements

### Requirement: Restore an audited split child incident
The adapter SHALL only restore a damaged split from the exact previous snapshot and audited candidate under an owned lease and write lock, after a new backup.

#### Scenario: Verified recovery
- **WHEN** the live budget differs from the backed-up budget only by the documented child corruption and its exact balance effect
- **THEN** the adapter updates the parent and independently verifies that the full budget matches the backup except for the requested note.

#### Scenario: Unexpected differences
- **WHEN** any other state or transaction has changed
- **THEN** the adapter refuses the recovery without writing.

### Requirement: Disable unsafe child update
The adapter SHALL reject direct split child note changes.

#### Scenario: Unsafe command requested
- **WHEN** a split child note amendment is requested
- **THEN** no Actual write occurs.
