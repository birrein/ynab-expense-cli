## Purpose
Correct a historical split date supported by independent purchase and statement evidence without duplicating the underlying expense.

## ADDED Requirements

### Requirement: Correct an evidenced historical split date
The system SHALL permit a date correction of a cleared, unreconciled, unscheduled and ledger-unowned historical split only when an independently verified Gmail purchase receipt and bank statement establish identity, account, amount and the new date. The old and new dates MUST be distinct, valid, within the same month and no more than seven days apart. It SHALL require the complete exact parent and child snapshots, an explicit cleared-preservation flag, and an active account; refuse ambiguous destination duplicates or any changed child, ledger ownership or prior pending audit; preserve every identity, amount, category, payee, note and status on parent and children and unchanged balances.

#### Scenario: Evidenced split
- **WHEN** the purchase and statement establish an eligible split with the same account and amount and a different same-month date within seven days
- **THEN** preview proposes only the date change and the verified application preserves all other data.

#### Scenario: Conflicting or unsafe evidence
- **WHEN** evidence is absent, identity or split changed, date outside bounds, reconciliation or ledger ownership exists, or a destination duplicate is possible
- **THEN** no write occurs.

### Requirement: Durable audited verification
The operation SHALL acquire the owning lease and writer lock, back up, revalidate, persist a pending audit before writing, sync, and independently compare every transaction, balance and other snapshot data before completing the audit. An exact completed retry SHALL verify without writing; a pending audit or unexplained changed state SHALL refuse retry pending investigation.

#### Scenario: Verified retry
- **WHEN** the identical fully audited correction is retried
- **THEN** it verifies current state and does not write again.

#### Scenario: Interrupted write
- **WHEN** a prior write may have occurred but the audit remains pending
- **THEN** no additional write is performed and investigation is required.
