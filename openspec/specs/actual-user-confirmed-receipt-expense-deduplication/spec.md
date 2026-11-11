# actual-user-confirmed-receipt-expense-deduplication Specification

## Purpose
Safely retire a historical duplicate when the user confirms purchase identity and the receipt and statement independently corroborate it.

## Requirements

### Requirement: Guarded confirmed receipt deduplication
The adapter SHALL accept a historical expense with a different local amount only after the operator verifies the receipt, full statement, and explicit user confirmation that the two entries represent one purchase. It SHALL require exact same account, date, payee, and resolved category; an existing verified statement-backed retained ledger entry; exact historical identity and notes containing the distinctive item identity; receipt and statement IDs; and two whole-peso CLP amounts differing by at most CLP 1. The historical entry SHALL be simple, unowned by ledger, not cleared, reconciled, transferred or scheduled. Declared IDs and confirmation text SHALL NOT substitute for human evidence review.

#### Scenario: Confirmed one-peso difference
- **WHEN** the operator supplies the exact verified entries, receipt, statement and explicit user confirmation
- **THEN** plan identifies the historical entry and local balance delta; apply requires lease, lock, backup, revalidation, audit and independent verification of all remaining data.

#### Scenario: Ambiguity or mismatch
- **WHEN** identity, source, confirmation, category, date, account, amount, notes or eligibility do not match
- **THEN** the operation SHALL fail without mutation.

#### Scenario: Verified retry
- **WHEN** the exact fully audited retirement is retried
- **THEN** the result SHALL be verified without a second deletion.
