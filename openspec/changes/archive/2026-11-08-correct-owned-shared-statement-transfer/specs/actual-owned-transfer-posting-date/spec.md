## ADDED Requirements

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
