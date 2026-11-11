# actual-owned-transfer-posting-date Specification

## Purpose
Correct independently evidenced posting dates of already owned transfers without losing original provenance or duplicating movements.

## Requirements

### Requirement: Correct one owned transfer posting date safely
The adapter SHALL accept exact snapshots of both reciprocal unreconciled simple transfer legs and their unchanged verified original cashflow ledger, a source receipt and two distinct independently inspected statements. It SHALL require active accounts, unique ownership, no conflicting nearby transfers, and an origin posting date one to four days after the unchanged destination date. The original receipt and at least one of the two supplied statements SHALL match recorded evidence. It SHALL preview a hash of all relevant data and daily balances; preserve both IDs, links, notes, sources, amounts, other fields, balances and ledger; back up and revalidate under lease; persist pending audit before writing; and independently verify the entire state before completion.

#### Scenario: Unique transfer with later origin posting
- **WHEN** verified source, snapshots, receipt and distinct statements uniquely establish the origin posting and unchanged destination
- **THEN** preview proposes the single date correction, which apply verifies without creating a transfer.

#### Scenario: Original origin statement
- **WHEN** the original verified cashflow cites the origin statement and receipt, and the operator independently inspects a distinct destination statement
- **THEN** the transfer remains eligible under all other correction controls.

#### Scenario: Conflicting or unverified evidence
- **WHEN** ownership, snapshot, evidence, account, date, reciprocal linkage or a nearby same-value movement conflicts, or neither statement is an original source
- **THEN** the adapter refuses any mutation.

#### Scenario: Interrupted or repeated update
- **WHEN** update or verification is interrupted after pending intent
- **THEN** pending audit blocks subsequent financial mutation; an exact completed retry verifies without a write.

### Requirement: Align owned transfers with shared statement evidence
The adapter SHALL allow an explicitly selected correction of both reciprocal legs to the same posting date one to four days after their common original date when an independently verified unique transfer receipt and both distinct account statements establish the posting. The original verified ledger and candidate SHALL include two distinct statement Gmail IDs explicitly identified by the operator; only those statement IDs may be shared by other movements. Original transfer receipts SHALL remain unique. The original Drive list MAY be absent or empty. The adapter SHALL preserve all other provenance, transaction fields, balances and existing controls, hash the complete preview, back up, record pending intent before either write and verify the complete budget independently before marking the audit complete. Exact original and completed retries SHALL verify without writing.

#### Scenario: Both statements show the same later date
- **WHEN** the original candidate, receipt, explicitly identified shared statement messages, two independently inspected account statements and reciprocal pair uniquely match
- **THEN** the adapter previews and verifies changing both dates without creating a transfer or changing original evidence.

#### Scenario: Shared receipt or conflicting source
- **WHEN** any transfer-specific receipt is reused, either statement message is missing or identical, the statements disagree, an undeclared match exists, or any other control fails
- **THEN** no financial mutation is allowed.

#### Scenario: Partial update
- **WHEN** either date update or independent readback fails after pending intent
- **THEN** the audit stays pending and financial writes remain blocked until investigated.
