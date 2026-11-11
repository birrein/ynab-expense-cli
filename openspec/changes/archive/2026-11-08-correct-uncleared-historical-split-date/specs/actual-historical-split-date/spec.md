## MODIFIED Requirements

### Requirement: Correct an evidenced historical split date
The system SHALL permit a date correction of an unreconciled, unscheduled and ledger-unowned historical split, cleared or uncleared, only when an independently verified Gmail purchase receipt and bank statement establish identity, account, amount and the new date. The old and new dates MUST be distinct, valid, within the same month and no more than seven days apart. It SHALL require the complete exact parent and child snapshots, an explicit cleared-preservation flag equal to the existing parent and all children, and an active account; refuse mixed cleared statuses, ambiguous destination duplicates or any changed child, ledger ownership or prior pending audit; preserve every identity, amount, category, payee, note and status on parent and children and unchanged balances.

#### Scenario: Evidenced split
- **WHEN** the purchase and statement establish an eligible split with the same account and amount and a different same-month date within seven days
- **THEN** preview proposes only the date change and the verified application preserves all other data.

#### Scenario: Uncleared split
- **WHEN** the parent and each child are uncleared, unreconciled and all other evidence and safety controls pass, with an explicit false cleared-preservation flag
- **THEN** the operation changes only the dates and preserves their uncleared status.

#### Scenario: Conflicting or unsafe evidence
- **WHEN** evidence is absent, identity or split changed, date outside bounds, statuses differ, reconciliation or ledger ownership exists, or a destination duplicate is possible
- **THEN** no write occurs.
