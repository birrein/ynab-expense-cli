## Purpose

Correct a statement-supported historical installment date without duplicating or altering the purchase and its other installments.

## ADDED Requirements

### Requirement: Correct a uniquely evidenced historical installment date
The adapter SHALL accept only an exact, simple, unreconciled, unscheduled historical installment absent from source-ledger ownership, with original purchase evidence, the billing statement and exact neighboring installments in the same series. It SHALL preserve the transaction ID, amount, payee, category, notes, other installments and total balances.

#### Scenario: Matching installment
- **WHEN** the statement identifies a unique billed installment, the exact original matches, adjacent numbered installments confirm the series, and the target date lies in the correct billing sequence
- **THEN** preview proposes changing only its date and a verified commit changes only that field.

#### Scenario: Conflicting identity or prior write
- **WHEN** the original, neighbor, statement, ledger ownership or duplicate detection conflicts, or the date was already changed without an exact completed audit
- **THEN** the operation SHALL stop without a new write.

### Requirement: Backup and verify independently
The operation SHALL require the owning lease, exclusive lock, backup, revalidation, sync, independent readback and durable audit. It SHALL wait for the official API's asynchronous update and reject an unexplained partial state.

#### Scenario: Verified exact retry
- **WHEN** the exact audited correction is retried
- **THEN** the adapter independently verifies the original transaction and unchanged neighbors without changing data again.
