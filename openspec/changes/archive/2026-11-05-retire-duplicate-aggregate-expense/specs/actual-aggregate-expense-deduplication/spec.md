## Purpose
Remove a verified aggregate duplicate while preserving itemized transactions, their source details, and the aggregate's original ledger provenance.
## ADDED Requirements
### Requirement: Retire a ledger-owned duplicate aggregate with exact component evidence
The adapter SHALL require a complete statement, the exact ledger-owned aggregate and at least two distinct historical same-account, same-payee and same-date component identities whose amounts sum exactly to the aggregate. It SHALL preserve each component and all other records, back up, revalidate, delete the aggregate, independently verify the balance and update its source ledger to a non-recreating superseded audit.
#### Scenario: Verified aggregate duplicate
- **WHEN** a complete statement and source prove that the exact components are the same payment as the aggregate
- **THEN** the adapter backs up, verifies the lease and lock, retires only the aggregate, synchronizes and independently verifies the retained components and all other data.
#### Scenario: Missing component, conflicting source or uncertain evidence
- **WHEN** a component or identity, sum, payee, account, date, source or audit differs
- **THEN** no mutation occurs.
#### Scenario: Exact retry
- **WHEN** the same audited retirement is retried
- **THEN** it verifies the components and audit without creating or deleting another transaction.
