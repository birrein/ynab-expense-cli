## ADDED Requirements

### Requirement: Verify a completed reconstruction after subsequent wallet movements
A retry of an already completed reconstruction SHALL verify its exact original transaction identities, reciprocal transfer, source details, categories, notes, account metadata and shared card ledger without requiring the present wallet balance to equal the balance at the original reconstruction. The initial write SHALL still verify the complete budget and exact expected balance before completing the audit.

#### Scenario: A later legitimate wallet transaction
- **WHEN** an unrelated later wallet transaction changes the current wallet balance while all originally audited rows and shared card source remain exact
- **THEN** a completed retry SHALL verify read-only without failing due to the new balance.

#### Scenario: An audited row changes
- **WHEN** an originally audited transaction, counterpart, source, account or shared card ledger is missing, duplicated or changed
- **THEN** the retry SHALL fail without writing.
