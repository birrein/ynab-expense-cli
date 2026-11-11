## Purpose
Preserve the bank-verified charge while removing a separately evidenced historical estimate of the same foreign-currency purchase.

## ADDED Requirements

### Requirement: Guarded retirement of an FX-conversion duplicate
The adapter SHALL allow retirement of a historical local-currency estimate with a different local amount only when the operator has verified the entire bank statement and the exact original foreign purchase, and the candidate proves exact account, date, merchant, category, original currency and amount, both local amounts, original notes, retained bank ledger source and statement link. Both records SHALL be simple, and the historical entry SHALL be unowned by the ledger, unreconciled and unscheduled. The source must belong to the retained bank-verified entry. A null historical imported ID SHALL be allowed only in this narrowly evidenced mode.

#### Scenario: Same foreign purchase with a different estimate
- **WHEN** the exact historical estimate and the bank-backed record have the same account, day, merchant and category and both notes identify the same original foreign amount and currency
- **THEN** plan shows the two local amounts and apply requires lease, lock, backup, revalidation, deletion of only the historical record and independent verification of all unrelated data and the exact retired amount.

#### Scenario: Ambiguous or changed identity
- **WHEN** any identity, note, currency amount, bank source, statement, status or snapshot differs, or the old entry is already absent without a matching audit
- **THEN** the operation SHALL fail without a new mutation.

#### Scenario: Audited retry
- **WHEN** the exact retirement with a completed audit is retried
- **THEN** it SHALL verify and return the existing result without another deletion.
