## Purpose

Safely remove a duplicate historical split when an independently evidenced Uber Eats order was charged for a different final amount.

## ADDED Requirements

### Requirement: Evidence-backed split retirement
The adapter SHALL retire an unreconciled, unowned historical split only when an independently verified retained split has the same account and date, provider receipt and settled statement, and a unique completed provider order matches a distinctive historical child item and its exact pre-discount amount. Both splits and all children SHALL be supplied as exact snapshots; the operator MUST verify the bank statement and receipt, and the adapter MUST validate the source ledger, export hash, item identity, quantity, price, order total, and ambiguity checks. Different split amounts and allocations are permitted only in this evidence-backed operation.

#### Scenario: Distinctive provider item and settled order
- **WHEN** all exact snapshots, ledger source, provider export, unique item and completed order match and a statement independently confirms the final charge
- **THEN** the plan identifies the old split, preserved split and exact balance change, and apply with that exact plan backs up, audits and retires only the old split before independently verifying the entire budget.

#### Scenario: Ambiguous evidence or modified data
- **WHEN** the order, item, historical note, amount, account, source, export, snapshot or unique identity does not match, or a pending audit exists
- **THEN** the operation MUST refuse to write.

#### Scenario: Interrupted or repeated operation
- **WHEN** a write is interrupted
- **THEN** a durable pending audit MUST block further writes until investigated; an identical completed retry SHALL only verify and never delete again.
