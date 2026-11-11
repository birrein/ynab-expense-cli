# actual-cashflow-expense-notes Specification

## Purpose
Safely correct descriptive text on an individually verified statement-backed expense.

## Requirements

### Requirement: Narrow cashflow note correction
The adapter SHALL require exact live transaction identity, verified cashflow source, old notes and a unique plain-text substring; it SHALL preserve all links, source markers, hashtags, transaction fields and unrelated budget state with lease, lock, backup, sync, audit and independent readback.

#### Scenario: Correct a description
- **WHEN** a verified simple expense has precisely identified old and new descriptive text
- **THEN** only that substring changes and the result is independently verified.

#### Scenario: Unsafe or ambiguous edit
- **WHEN** identity, ledger, source, notes or metadata differs, or the edit overlaps protected provenance
- **THEN** the adapter refuses to write.
