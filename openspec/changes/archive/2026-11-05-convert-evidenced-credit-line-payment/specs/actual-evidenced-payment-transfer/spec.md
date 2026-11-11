## Purpose
Convert independently evidenced credit-line principal payments already imported as expenses into accurate linked transfers without losing their original identity.

## ADDED Requirements
### Requirement: Convert an evidenced historical payment safely
The adapter SHALL accept an exact unreconciled simple payment and two verified statements identifying both accounts, the principal amount and date. It SHALL reject identity, ledger, duplicate, account, date or source conflicts. It SHALL preserve the original transaction ID, amount, date, notes and imported ID.

#### Scenario: Confirmed principal payment
- **WHEN** both statement rows and the exact existing transaction match
- **THEN** plan proposes conversion and apply requires lease, lock, backup and revalidation, converts through the official API, waits for the linked operation, synchronizes, independently verifies both legs, balances and unrelated records, and records an audit.

#### Scenario: Retry or incomplete conversion
- **WHEN** the same request is retried after a verified audit
- **THEN** it checks the existing pair and performs no additional financial write; a partial or unaudited state fails closed for investigation.

#### Scenario: Conflicting evidence or matching transaction
- **WHEN** another destination credit could be the same payment or a bank statement or transaction identity conflicts
- **THEN** the adapter refuses to mutate the budget.
