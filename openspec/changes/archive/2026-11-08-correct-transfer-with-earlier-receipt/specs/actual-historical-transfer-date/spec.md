## ADDED Requirements

### Requirement: Align a transfer when the receipt predates the historical date
The adapter SHALL allow an explicitly selected correction of both legs of an eligible reciprocal historical transfer when the operator independently verifies a payment receipt dated exactly one day before the shared historical date and two distinct complete account statements show the same later posting date. The posting date SHALL be after the historical date and no more than four days after the receipt. The operator SHALL inspect the receipt, both account statements and competing transactions and verify holder, origin, destination, amount, operation and postings. The adapter SHALL reject combination with other exception modes, ambiguous same-value transfers near the receipt, original or posting dates, and all source or snapshot conflicts. The existing hash-bound plan, balance, lease, lock, backup, pending-audit, independent full-budget readback and retry protections SHALL remain mandatory.

#### Scenario: Receipt one day before a historical date
- **WHEN** a receipt dated one day before an eligible historical pair and distinct statements identify one transfer with common posting no more than four days after the receipt
- **THEN** the adapter previews and verifies only both existing dates without creating a transfer.

#### Scenario: Evidence conflict or nearby competitor
- **WHEN** either date gap, receipt, statement, snapshot, source, mode or nearby equal-value transfer conflicts
- **THEN** the adapter refuses the mutation.
