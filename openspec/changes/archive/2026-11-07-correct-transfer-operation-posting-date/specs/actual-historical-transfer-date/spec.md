## MODIFIED Requirements

### Requirement: Correct both legs of an evidenced transfer date
The adapter SHALL require exact full snapshots of reciprocal simple unreconciled unowned legs, active accounts, independently reviewed receipt and statement, and an unambiguous correction of exactly one day within the same month. As an explicit alternative for a posting-date difference across a month boundary, it SHALL require a receipt, distinct origin and destination bank statement identifiers, a posting date equal to the existing date, and an operation date one to three calendar days earlier in the immediately preceding month. The operator SHALL independently verify both accounts, payment, dates and amounts against the receipt and both statements. It SHALL preserve both IDs, all non-date fields, cleared flags, account balances and unrelated data.

#### Scenario: Exact proven payment
- **WHEN** both legs, accounts, amounts, date and inspected evidence match with no competing pair
- **THEN** preview proposes updating both dates without creating a transfer.

#### Scenario: Missing evidence or conflicting pair
- **WHEN** a snapshot, statement, receipt, account, date or nearby match conflicts
- **THEN** the operation fails without writing.

#### Scenario: Cross-month bank posting delay
- **WHEN** two independently inspected distinct statements and a payment receipt establish the same transfer, its earlier operation date is at most three days before the old posting date across the month boundary, and no competing pair exists
- **THEN** preview SHALL propose changing both existing legs to the evidenced operation date under the existing audited workflow.

#### Scenario: Invalid posting evidence
- **WHEN** statement identifiers are invalid or identical, the supplied posting date differs from the existing date, dates are not in adjacent months, the operation is later, or the difference exceeds three days
- **THEN** the operation SHALL stop without writing.
