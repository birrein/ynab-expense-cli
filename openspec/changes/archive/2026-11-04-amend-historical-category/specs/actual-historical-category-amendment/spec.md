## Purpose
Correct a user-authorized historical expense category while preserving identity and the rest of the budget.
## ADDED Requirements
### Requirement: Historical category correction
The adapter SHALL preview and amend only an explicitly identified simple historical expense absent from the source ledger, given exact identity, old and new categories, and evidence of user authorization.
#### Scenario: Valid correction
- **WHEN** the identity and old category match, the destination category is active, and a valid lease and lock exist
- **THEN** the adapter backs up, changes only the category, synchronizes, independently verifies the entire budget, and records an audit.
#### Scenario: Conflict or unsupported transaction
- **WHEN** identity, category, ledger, account, destination, or transaction shape conflicts
- **THEN** the adapter rejects the amendment without writing.
#### Scenario: Retry after success
- **WHEN** the exact correction is retried after a successful write
- **THEN** the adapter verifies the target state without creating or rewriting the transaction and recovers the audit.
