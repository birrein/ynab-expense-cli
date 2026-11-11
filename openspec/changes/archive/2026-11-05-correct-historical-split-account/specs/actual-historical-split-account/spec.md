## Purpose
Correct the account of an evidenced historical split while protecting transaction identity and financial history.

## ADDED Requirements

### Requirement: Correct an evidenced split account safely
The system SHALL only correct an exact, unreconciled historical split between active accounts in the same budget, when the source statement and receipt support the destination and the former account statement covers the purchase without that charge. It MUST reject duplicate or ambiguous evidence and preserve parent and children identifiers, amounts, categories, payees, dates, notes, and other unrelated state. It MUST preview, acquire the run and writer lock, back up, synchronize and independently verify the entire result before recording an audit. Retries MUST NOT duplicate or rewrite a verified correction.

#### Scenario: Verified correction
- **WHEN** an eligible split exactly matches the expected identity and evidence with no destination duplicate
- **THEN** the parent and children move together and both balances change by the split amount, with all other data unchanged and an audit recorded

#### Scenario: Conflict or uncertainty
- **WHEN** the identity, evidence, account, provenance, split or destination duplicate check fails
- **THEN** the system refuses to write

#### Scenario: Failure after write
- **WHEN** a prior attempt may have written but was not independently verified
- **THEN** the system refuses a second write and requires recovery against the backup and audit evidence
