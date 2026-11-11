## Purpose

Safely correct obsolete descriptive notes on resolved transactions including split parents with ledger-backed provenance.

## ADDED Requirements

### Requirement: Bound correction and identity
The adapter SHALL accept a dedicated operation with exact account, date, amount, payee, imported ID, category, old notes, full source IDs, authorized descriptive replacement and evidence. It SHALL verify all authoritative ledger records and allow source IDs missing from notes only when linked by the ledger; all existing source links, tags and unrelated text MUST be preserved. Split parents MUST include an exact complete expected child snapshot and matching total; children, transfers, unresolved and ambiguous targets MUST be rejected.

#### Scenario: Source not present in notes
- **WHEN** the ledger identifies a verified source that is absent from the original notes
- **THEN** preview SHALL preserve the existing notes' source links without inventing or adding a link.

#### Scenario: Split children changed
- **WHEN** any split child differs from the expected complete snapshot
- **THEN** the adapter SHALL reject the amendment without a write.

### Requirement: Guarded financial invariants
The adapter SHALL require the active run lease and write lock, backup, synchronized revalidation, independent full-budget readback and ledger audit. It SHALL preserve all fields and all unrelated budget data except the target parent's note and support exact-candidate recovery without duplicating writes.

#### Scenario: Recovery after interrupted write
- **WHEN** the exact desired note already exists after an interrupted attempt
- **THEN** independently verify and recover the audit without another update.
