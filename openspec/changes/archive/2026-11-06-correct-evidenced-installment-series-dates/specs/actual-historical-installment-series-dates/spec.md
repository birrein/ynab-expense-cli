## Purpose

Align an entire historical installment series with verified statement billing dates while preserving all other transaction data.

## ADDED Requirements

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
