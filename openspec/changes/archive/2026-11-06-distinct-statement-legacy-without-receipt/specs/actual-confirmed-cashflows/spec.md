## MODIFIED Requirements

### Requirement: Distinguish separate same-amount statement purchases
The adapter SHALL allow an otherwise conflicting expense only when a verified statement explicitly contains separate transactions for different merchants and dates with independent receipts; or a verified statement identifies different merchants and dates and a separately inspected receipt identifies the exact single matching legacy transaction; or an operator independently identifies one exact dated, annotated legacy movement without a receipt or payee against a unique matching row in the shared statement and the statement separately identifies another merchant on another date; or separately identified same-merchant rows on different dates have their account, amounts and complete set of matching existing transactions verified against the shared statement. The candidate SHALL identify the exact existing transaction or transactions and shared statement and preserve all duplicate and provenance checks. Statement identifiers and supplied row descriptions do not themselves prove their contents; an operator MUST independently inspect the statement and applicable receipts.

#### Scenario: Two separately supported purchases
- **WHEN** one matching transaction in the same account has a different merchant and date, the same amount, and a distinct receipt and shared statement
- **THEN** plan may propose a new expense and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Distinct legacy purchase and statement row
- **WHEN** one matching simple unlinked legacy transaction has an exact snapshot, a different merchant and date, an independently verified prior receipt, and a shared statement independently verifies both separate rows
- **THEN** plan may propose the new statement-backed expense and apply preserves the prior transaction, separates its receipt from the new sources and performs backup and independent readback.

#### Scenario: Statement-backed annotated legacy movement without receipt
- **WHEN** an operator independently verifies a unique prior dated statement row and its exact unlinked simple legacy movement with nonempty descriptive notes, together with a separate different-merchant different-date row of equal amount on the same account and statement
- **THEN** the adapter may propose only the new row, including an explicit reason if uncategorized, and apply audits the prior snapshot and evidence with backup and independent readback, without creating or inventing a receipt.

#### Scenario: Multiple same-merchant rows on distinct dates
- **WHEN** the operator has verified distinct dated rows in a statement, and the candidate identifies the shared statement and exact snapshots of all nearby matches on other dates with the same account, payee, category and amount
- **THEN** plan may propose one unique expense, and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Multiple matches or incomplete evidence
- **WHEN** any other matching transaction is not explicitly accounted for, any existing snapshot differs, a date is shared, a source conflicts, or required independently inspected evidence is missing or inconsistent
- **THEN** the adapter leaves the candidate in review without writing.

