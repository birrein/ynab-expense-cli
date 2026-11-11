## Purpose

Reconstruct historically billed card installments without duplicating a purchase total or changing unrelated financial records.

## ADDED Requirements

### Requirement: Require complete, exact evidence before replacement

The adapter SHALL accept only one exact, simple, uncategorized-or-categorized historical purchase that is not reconciled, cleared, scheduled, a transfer, or owned by an existing source ledger. It SHALL require an active on-budget card account, an existing payee, original purchase evidence and at least two distinct, consecutive, already billed installments. Each installment SHALL have a unique stable source identifier, a distinct inspected statement identifier, billing date, sequence number and exact negative amount; their sum MUST equal the historical purchase amount. The operator MUST independently check that each statement and purchase document refer to the same transaction. Conflicts, partial series, possible duplicates, unexpected data or unavailable evidence SHALL prevent writes.

#### Scenario: Exact full series
- **WHEN** a complete evidenced series matches an unchanged, unowned historical total and no matching installments exist
- **THEN** preview proposes replacing the total with that series without modifying the budget.

#### Scenario: Incomplete or conflicting evidence
- **WHEN** a statement, number, amount, source, account, category, transaction identity or ledger state is inconsistent
- **THEN** preview and commit refuse to change the budget.

### Requirement: Preserve identity and verify the replacement

The committed operation SHALL retain the historical transaction ID for the first billed installment, preserve its account, payee and category, and create the remaining installments with stable unique sources and evidence links. The original amount, date and notes SHALL remain available in a durable audit. The sum of the resulting installments and total account balance SHALL match the original total; all unrelated transactions, schedules, rules, balances and budget metadata SHALL remain unchanged.

#### Scenario: Successful conversion
- **WHEN** a valid preview is committed and independently verified
- **THEN** only the original total is transformed into the first installment, the other installments appear exactly once, and account totals are unchanged.

### Requirement: Fail closed on interrupted writes

The operation SHALL require an owned lease, exclusive lock, private backup and complete revalidation before recording a pending audit and changing any financial data. It SHALL synchronize and independently read back the whole budget before marking the audit complete. A matching verified retry SHALL only verify; a pending audit, changed original, unexpected partial series or absent audit SHALL stop and require investigation without replacing source identifiers.

#### Scenario: Exact verified retry
- **WHEN** the same completed candidate is retried
- **THEN** it returns the existing verified series without creating, changing or deleting transactions.

#### Scenario: Interrupted conversion
- **WHEN** the audit is pending or the original no longer matches without a completed matching audit
- **THEN** no automatic retry or new write occurs and the backup and source identities remain available for investigation.
