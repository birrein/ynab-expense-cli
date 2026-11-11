## Purpose

Record a confirmed reimbursement of multiple purchases without misrepresenting it as ordinary income or duplicating purchases.

## ADDED Requirements

### Requirement: Reconcile several purchases against a bank reimbursement
The adapter SHALL require exact snapshots and source-ledger records of at least two uncategorized unreconciled expenses, a confirmed bank deposit with unique source and date, evidence that the sender reimbursed those expenses, and an existing active non-income category. The operation SHALL categorize the purchases and incoming reimbursement in that category, preserve purchase IDs and original source links, disclose the exact difference between the bank amount and purchases, and never label an unexplained excess as ordinary income. It SHALL preview, require a lease and lock, back up, revalidate, sync, independently verify all budget data and balance deltas, and persist an idempotent audit. A partial or conflicting write SHALL stop for investigation.

#### Scenario: Reimbursement with small excess
- **WHEN** two purchases and the bank deposit are independently verified and their relationship is confirmed
- **THEN** the same category offsets those purchases with the actual incoming amount, while notes and audit retain the remaining difference.

#### Scenario: Stale or duplicate evidence
- **WHEN** a source, deposit, purchase or ledger identity conflicts or a partial unaudited write exists
- **THEN** the operation rejects further financial writes.

#### Scenario: Repeating verified operation
- **WHEN** the identical completed candidate is retried
- **THEN** the operation verifies the existing audit without creating another deposit.
