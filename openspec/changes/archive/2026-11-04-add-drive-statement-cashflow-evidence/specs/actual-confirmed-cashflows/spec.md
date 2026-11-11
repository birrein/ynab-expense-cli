## ADDED Requirements

### Requirement: Verified Drive statement evidence
The system SHALL accept canonical Google Drive file identifiers as cashflow evidence when the operator has verified the statement's account, date and amount, without inventing Gmail sources. The system SHALL retain the actual Drive links and distinct stable bank-row identity through planning, writing, audit and independent readback.

#### Scenario: Cashflow supported only by a Drive statement
- **WHEN** a candidate has no Gmail IDs and has a valid independently verified Drive file identifier
- **THEN** it may be planned under the existing evidence and duplicate rules and the resulting notes and audit preserve the Drive file reference

#### Scenario: Cashflow supported by both Gmail and Drive
- **WHEN** both sources are supplied
- **THEN** each source is preserved as its own canonical link and Gmail-only candidates remain unchanged

#### Scenario: Missing or malformed evidence
- **WHEN** a candidate contains neither a Gmail source nor a valid Drive identifier or contains malformed or repeated identifiers
- **THEN** the system returns review and performs no financial write

#### Scenario: Shared statement describes multiple rows
- **WHEN** multiple transactions cite the same statement
- **THEN** each must have its own stable bank-row source identity and satisfy the existing duplicate checks
