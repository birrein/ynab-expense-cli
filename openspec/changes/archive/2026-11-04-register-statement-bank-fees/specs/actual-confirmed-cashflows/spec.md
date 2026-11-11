## ADDED Requirements

### Requirement: Statement-backed fee expense
The adapter SHALL accept a negative bank charge with an existing non-income category and known payee, a unique line-level bank source, original statement Gmail source and direct evidence. It SHALL apply the same duplicate checks, lease, backup, independent readback and audit as confirmed cashflows.

#### Scenario: Confirmed credit-line fee
- **WHEN** a statement confirms one uniquely identifiable bank interest or tax and the expense category is known
- **THEN** preview proposes one expense and commit independently verifies one corresponding debit.
