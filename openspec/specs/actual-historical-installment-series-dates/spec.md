# actual-historical-installment-series-dates Specification

## Purpose
Align an entire historical installment series with verified statement billing dates while preserving all other transaction data.

## Requirements

### Requirement: Correct a complete evidenced series
The adapter SHALL require exact snapshots of a complete historical installment series, one purchase receipt and one distinct statement per installment. It SHALL ensure unique consecutive numbers, matching account, payee, category and series identity, exact amounts, valid consecutive target months and preservation of cleared status. It SHALL reject reconciled, scheduled, transferred or ledger-owned records, conflicting targets and any changed snapshots. It SHALL preview, use an active lease and lock, create a full backup and durable pending audit before writing, sync, and independently verify the complete budget and unchanged balances. A partial or unaudited write SHALL stop for manual investigation.

#### Scenario: Complete verified date correction
- **WHEN** every installment, statement and purchase receipt is independently verified and the candidate matches the current state
- **THEN** the adapter changes only the dates to the billed dates, preserves cleared flags and IDs, and records a complete audit after independent verification.

#### Scenario: Conflicting or partially changed series
- **WHEN** any snapshot, account, target, sequence, ledger record or pending audit conflicts
- **THEN** no new write is attempted.

#### Scenario: Exact retry
- **WHEN** the same candidate is retried after its complete audit
- **THEN** the adapter verifies the current result and performs no new write.

### Requirement: Recover a fully applied interrupted series audit
The adapter SHALL provide an explicit verification-only recovery for an exact pending series correction. Under an active lease and exclusive lock, it SHALL validate the stored candidate and backup, independently download the live budget, and compare the entire result against the pre-write snapshot allowing only the exact intended dates. It SHALL preserve the original backup and record verified recovery without updating transactions. A partial series, changed candidate, missing backup, unrelated change or failed download SHALL leave the audit pending and block recovery.

#### Scenario: Interrupted sync after every date was applied
- **WHEN** the stored pending candidate and backup agree and an independent read matches the complete intended budget transformation
- **THEN** the adapter records the audit as complete with original provenance and performs no financial write.

#### Scenario: Partial or conflicting recovery
- **WHEN** any installment is missing or has an unexpected date or field, or any other budget data differs from the backup
- **THEN** the adapter preserves the pending audit and performs no financial write.

#### Scenario: Exact recovery retry
- **WHEN** an already completed recovery is retried with its identical candidate
- **THEN** the adapter verifies the stored recovery and current state without applying the series again.
