## ADDED Requirements

### Requirement: Align both transfer legs to a later common statement date
The adapter SHALL support changing both legs of one reciprocal historical transfer from the same receipt date to the same later posting date when the operator independently verifies the receipt and both distinct bank statements. The posting date SHALL be one to four calendar days later. The adapter SHALL require exact snapshots, active accounts, no conflicting source ownership or nearby competitors, and a hash-bound plan showing daily effects. It SHALL preserve IDs, amounts, payees, linkage, cleared states, unrelated data and final balances. A backup and durable pending audit SHALL precede either write. Both posting dates and full state SHALL be checked by an independent download before completing the audit; an interrupted operation SHALL block further financial mutations until investigated. An exact completed retry SHALL verify without writing.

#### Scenario: Matching bank postings
- **WHEN** two independently reviewed statements identify the same later posting date and the receipt identifies the original transfer
- **THEN** preview proposes changing both dates with daily effects and application verifies the existing reciprocal pair without creating another transaction.

#### Scenario: Divergent or incomplete evidence
- **WHEN** either statement date differs, a receipt or statement is missing, the date gap exceeds four days, the snapshots changed or a competing transfer exists
- **THEN** the operation refuses to write.

#### Scenario: Partial update
- **WHEN** either write or independent verification fails after the audit begins
- **THEN** the audit remains pending and further automatic financial mutations are blocked.
