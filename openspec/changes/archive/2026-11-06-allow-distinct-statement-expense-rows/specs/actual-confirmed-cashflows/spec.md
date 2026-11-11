## MODIFIED Requirements

### Requirement: Distinguish separate same-amount statement purchases
The adapter SHALL allow an otherwise conflicting expense only when a verified statement explicitly contains separate transactions for different merchants and dates with independent receipts, or separately identified same-merchant rows on different dates whose account, amounts and complete set of matching existing transactions have been verified against the shared statement. The candidate SHALL identify the exact existing transaction or transactions and shared statement and preserve all duplicate and provenance checks. Statement identifiers and supplied row descriptions do not themselves prove their contents; an operator MUST independently inspect the statement.

#### Scenario: Two separately supported purchases
- **WHEN** one matching transaction in the same account has a different merchant and date, the same amount, and a distinct receipt and shared statement
- **THEN** plan may propose a new expense and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Multiple same-merchant rows on distinct dates
- **WHEN** the operator has verified distinct dated rows in a statement, and the candidate identifies the shared statement and exact snapshots of all nearby matches on other dates with the same account, payee, category and amount
- **THEN** plan may propose one unique expense, and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Multiple matches or incomplete evidence
- **WHEN** any other matching transaction is not explicitly accounted for, any existing snapshot differs, a date is shared, a source conflicts, or required statement or receipt evidence is missing or inconsistent
- **THEN** the adapter leaves the candidate in review without writing.
