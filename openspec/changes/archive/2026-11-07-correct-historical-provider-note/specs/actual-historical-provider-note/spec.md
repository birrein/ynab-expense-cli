## Purpose

Correct an evidenced historical expense description while preserving the transaction, source context and entire budget.

## ADDED Requirements

### Requirement: Correct a historical note with provider evidence
The adapter SHALL accept an exact snapshot of a simple historical unreconciled expense, distinct bank statement and provider receipt Drive IDs, a unique literal fragment and its replacement, and evidence. The operator SHALL verify both documents and transaction identity. It SHALL reject records with ledger ownership, imported sources, schedules, transfers, splits, tags, links or source metadata, ambiguous fragments, invalid IDs and changed snapshots. It SHALL preserve all other fields and balances and require lease, backup, revalidation, audit and full independent readback.

#### Scenario: Correct supported historical description
- **WHEN** the operator independently verifies the statement and receipt for the exact historical transaction and a unique descriptive fragment is incorrect
- **THEN** preview SHALL show both notes and commit SHALL change only that fragment with backup and independently verified budget invariants.

#### Scenario: Ambiguous evidence or state
- **WHEN** the evidence IDs are invalid or identical, a note contains protected source metadata or tags, or the transaction or fragment does not match exactly
- **THEN** the adapter SHALL stop without writing.

#### Scenario: Exact audited retry
- **WHEN** an identical candidate has a completed audit and the transaction matches the corrected snapshot
- **THEN** the adapter SHALL verify without writing or creating a second backup.
