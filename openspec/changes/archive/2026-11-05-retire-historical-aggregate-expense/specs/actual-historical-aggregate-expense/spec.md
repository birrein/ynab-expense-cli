## Purpose

Preserve individually evidenced statement lines while retiring their duplicate historical aggregate.

## ADDED Requirements

### Requirement: Historical aggregate retirement
The adapter SHALL require exact identity of the historical aggregate, at least two separately ledger-backed simple components of the same account, date and payee, and a verified statement showing their amounts and sum. It SHALL preserve the components, create a backup, lock, revalidate, synchronize, independently read back and audit the removed aggregate.

#### Scenario: Verified duplicate aggregate
- **WHEN** two bank-backed components sum to an unowned historical aggregate on the same date and account
- **THEN** only that aggregate is removed and the components remain unchanged.

#### Scenario: Unproven component or owner
- **WHEN** the aggregate is owned by the ledger, a component is unverified, or identities and sum differ
- **THEN** no transaction is removed.
