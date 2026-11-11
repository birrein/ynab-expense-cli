## ADDED Requirements
### Requirement: Distinguish separate same-amount statement purchases
The adapter SHALL allow an otherwise conflicting expense only when a verified statement explicitly contains separate transactions for different merchants and dates, and independent receipts identify each. The candidate SHALL identify the exact existing transaction and shared statement and preserve all duplicate and provenance checks.

#### Scenario: Two separately supported purchases
- **WHEN** one matching transaction in the same account has a different merchant and date, the same amount, and a distinct receipt and shared statement
- **THEN** plan may propose a new expense and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Multiple matches or incomplete evidence
- **WHEN** any other matching transaction exists or a merchant, date, statement or receipt is missing or conflicts
- **THEN** the adapter leaves the candidate in review without writing.
