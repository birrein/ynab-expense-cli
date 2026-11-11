## Purpose

Allow explicit corrections of descriptive notes on existing categorized Actual expenses while preserving provenance, financial state and unrelated edits.

## ADDED Requirements

### Requirement: Preview a bounded notes amendment

The adapter SHALL preview a transaction-notes amendment without writing, requiring an exact transaction ID, account, payee, date, integer amount, resolved category, original sources, previous notes and an evidence-backed unique literal replacement. It SHALL reject split, transfer, conflicting operations, ambiguous sources and replacements touching links, tags or source metadata.

#### Scenario: Valid preview
- **WHEN** the current expense and authoritative ledger match all candidate preconditions
- **THEN** plan displays the exact old and proposed notes without changing the budget, backups or state

#### Scenario: Stale or unsafe candidate
- **WHEN** any identity, category, source, ledger or previous-notes precondition differs, or protected metadata would be replaced
- **THEN** the adapter rejects the amendment without writing

### Requirement: Commit through exclusive ownership and a backup

The adapter SHALL require explicit commit, the owning run lease and the existing exclusive write lock. It SHALL restrict the budget to the currency allowlist, create a private pre-write ZIP and snapshot, recheck current state and lease, patch only notes and synchronize.

#### Scenario: Foreign lease or lock
- **WHEN** another execution owns the lease or a write lock already exists
- **THEN** apply fails without taking ownership, deleting that lock or changing financial state

#### Scenario: Drift during backup
- **WHEN** transaction or other snapshot data changes before the final pre-write check
- **THEN** apply stops without sending the notes patch

### Requirement: Verify independently and preserve the ledger

The adapter SHALL download a separate budget copy after sync and verify exact new notes, unchanged target fields, source IDs, Gmail links, tags, transactions, catalog, rules, schedules and balances. Only after verification SHALL it append private amendment history to the original ledger records, preserving their fields, unrelated records and review markers.

#### Scenario: Verified amendment
- **WHEN** independent readback matches the expected notes-only snapshot
- **THEN** apply reports the existing ID as verified, retains backup and records audit history without creating a transaction or changing Gmail labels

#### Scenario: Readback or sync failure
- **WHEN** sync, independent download or any invariant check fails
- **THEN** apply fails, retains diagnostics and backup, and does not write a success audit or advance review markers

### Requirement: Recover without repeating a successful mutation

The adapter SHALL accept a retry only when all original identity and provenance preconditions still match and current notes equal either the exact old or exact desired notes.

#### Scenario: Already amended
- **WHEN** an identical candidate finds the exact desired notes
- **THEN** apply independently verifies the existing transaction without mutation or a new backup and preserves or recovers its amendment audit
