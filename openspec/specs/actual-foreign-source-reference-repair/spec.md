# actual-foreign-source-reference-repair Specification

## Purpose
Repair a descriptive link that incorrectly makes a separate financial transaction appear to own another transaction's source.

## Requirements

### Requirement: Repair one foreign source reference
The adapter SHALL require exact complete snapshots of two distinct ledger-owned transactions and their source records, and one foreign Gmail link in the target notes that belongs to the other transaction. It SHALL preserve all target-owned links, amounts, dates, identities, categories and unrelated budget data. It SHALL require a preview, exclusive lease and lock, backup, revalidation, sync, independent full-state readback and durable idempotent audit. It SHALL reject ambiguous ownership, any additional edit, stale state or unaudited partial changes.

#### Scenario: Extraneous link is owned by another transaction
- **WHEN** the target contains one extra reference and the source and separate owner are independently verified
- **THEN** the adapter removes only that reference and verifies that both transactions retain their owned sources.

#### Scenario: Ownership or prior state is unclear
- **WHEN** the link is not uniquely owned by the other transaction or target state differs from evidence
- **THEN** the adapter refuses the write.

#### Scenario: Repeat audited repair
- **WHEN** the identical verified candidate is retried
- **THEN** it verifies the audit and does not write again.
