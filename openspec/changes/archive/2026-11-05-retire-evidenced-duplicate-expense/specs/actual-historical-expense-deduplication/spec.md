## Purpose
Preserve a bank-backed expense and retire its independently evidenced duplicate without losing source audit or affecting other budget records.
## ADDED Requirements
### Requirement: Retire an exact evidenced historical duplicate
The adapter SHALL require a verified statement, exact retained and historical transaction identities and matching account and amount, with explicit reasons why the two rows are the same expense. It SHALL reject split, reconciled, scheduled, transferred, ledger-owned or changed historical records and retain their full details in the audit.
#### Scenario: Confirmed duplicate
- **WHEN** the exact historical record and its retained bank-backed counterpart match the evidence
- **THEN** apply requires lease and lock, backs up, revalidates, deletes only the historical duplicate using the official API, synchronizes and independently verifies all remaining transactions and balances.
#### Scenario: Missing audit or changed identity
- **WHEN** the historical item is absent without an exact successful audit or any identity, account, statement or ledger condition conflicts
- **THEN** the operation fails closed without a new mutation.
#### Scenario: Exact verified retry
- **WHEN** the exact audited retirement is retried
- **THEN** the existing result is verified without writing again.
