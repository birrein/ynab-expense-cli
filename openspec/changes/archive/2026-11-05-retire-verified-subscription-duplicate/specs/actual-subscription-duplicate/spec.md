## ADDED Requirements

### Requirement: Retire an evidence-verified subscription duplicate
The adapter SHALL only retire a historical subscription record with a mistaken amount when exact prior identity, matching date, account, category, payee and subscription text, and independently verified bank statement and receipt are provided.

#### Scenario: Exact evidence and identity
- **WHEN** all identity, source-ledger, statement and receipt checks pass and no conflicting transaction state exists
- **THEN** plan may preview retirement and apply SHALL back up, remove only the historical duplicate, synchronize and independently verify every other transaction and account balance.

#### Scenario: Ambiguous or stale evidence
- **WHEN** any ownership, amount, date, category, payee, receipt, statement, note or current transaction differs
- **THEN** the adapter refuses to write.

#### Scenario: Audited retry
- **WHEN** the same verified retirement is retried
- **THEN** it verifies the existing audit without writing again.
