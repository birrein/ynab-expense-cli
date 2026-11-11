## MODIFIED Requirements

### Requirement: Historical aggregate retirement
The adapter SHALL require exact identity of the historical aggregate, at least two separately ledger-backed simple components of the same account and date, and a verified statement showing their amounts and sum. Payees SHALL match unless an explicit, narrowly allowed issuer alias is independently verified against the live budget and all component categories match the historical aggregate. It SHALL preserve the components, create a backup, lock, revalidate, synchronize, independently read back and audit the removed aggregate.

#### Scenario: Verified duplicate aggregate
- **WHEN** two bank-backed components sum to an unowned historical aggregate on the same date and account
- **THEN** only that aggregate is removed and the components remain unchanged.

#### Scenario: Verified issuer alias
- **WHEN** the historical payee is Falabella and all components use Banco Falabella with the same category and the other identity and evidence checks pass
- **THEN** the operator can request retirement using the explicit issuer alias.

#### Scenario: Unproven component or owner
- **WHEN** the aggregate is owned by the ledger, a component is unverified, identities and sum differ, or an issuer alias is not explicitly supported and verified
- **THEN** no transaction is removed.
