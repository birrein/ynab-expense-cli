# actual-installment-series-rebalance Specification

## Purpose
Safely reconcile installment schedule amounts with confirmed statement amounts while retaining the total and original provenance.

## Requirements

### Requirement: Preview a complete balanced series
The adapter SHALL require exact schedule, rule, account, payee, category, original amounts, new amounts, dates, source IDs and evidence for the complete series. Both old and new sums SHALL equal the original purchase total. It SHALL reject missing, completed, posted, mismatched or ambiguous entries.

#### Scenario: Two offsets preserve purchase total
- **WHEN** a complete valid series contains equal and opposite changes to two unpaid schedules
- **THEN** the preview reports the before and after amounts without writing.

### Requirement: Verified rebalance and recovery
The adapter SHALL require the owning lease and lock, save a private backup and exact candidate, change only the specified schedule amounts and matching rules, synchronize, download independently, and verify all other financial data and total remain unchanged. It SHALL recover a partially applied identical candidate only from its own matching backup and SHALL never create a transaction while adjusting schedules.

#### Scenario: Successful rebalance
- **WHEN** a valid balanced series is committed
- **THEN** every schedule and rule has the requested amount, all other transactions and balances are unchanged, and a durable audit retains the backup.

#### Scenario: Interrupted rebalance
- **WHEN** the exact same candidate is retried after a partial write
- **THEN** only recognized original or intended states are accepted and completion is verified without changing unrelated data.
