# actual-superseded-partial-expense Specification

## Purpose
Preserve the bank-settled payment when a preliminary partial receipt was superseded by a corrected final receipt.

## Requirements

### Requirement: Retire a superseded partial receipt
The adapter SHALL retire a historical simple expense only when the partial and final documents share an identified receipt, the old transaction mentions that identity, the retained same-account categorized expense references the final document, and a bank statement confirms its larger final amount. Exact transaction identity, backup, locking, independent verification, and audit SHALL be enforced.

#### Scenario: Corrected final payment
- **WHEN** both receipts identify the same payment and the statement confirms only the larger final payment
- **THEN** the final transaction remains and the preliminary duplicate is retired with evidence and audit.

#### Scenario: Missing or contradictory evidence
- **WHEN** account, category, receipt identity, source, amount ordering or statement evidence does not match
- **THEN** no transaction is retired.
