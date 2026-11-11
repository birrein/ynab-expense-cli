## Purpose

Correct an externally disproved standalone subscription while preserving the verified billed bundle and account history.

## ADDED Requirements

### Requirement: Retire a disproved standalone subscription
The adapter SHALL permit retiring only an exact simple historical subscription when the operator has independently verified complete provider purchase history, a matching bundle receipt, consecutive account statements, and that the bundle includes the service and no standalone charge occurred. It SHALL require exact snapshots of the old record and retained billed bundle, same account and merchant, and distinct evidence identifying both services. It SHALL reject reconciled, scheduled, imported, ledger-owned, changed or ambiguous old records. A cleared but unreconciled legacy record SHALL be eligible only with explicit evidence that disproves the charge and its exact prior flag preserved. A run lease, lock, backup, durable pre-write intent, revalidation, synchronization, independent full-budget readback and completed audit SHALL be required. Pending or conflicting state SHALL block retries; an exact completed retry SHALL perform no write.

#### Scenario: Billed bundle replaces an unbilled expected subscription
- **WHEN** provider history, receipt and account statements confirm the bundle and disprove a separate charge for the matching period
- **THEN** the adapter removes only the old standalone entry, preserves the billed bundle and verifies the account delta.

#### Scenario: Evidence or ownership conflicts
- **WHEN** evidence, current snapshots, account identity, dates, prior ledger or audit is missing or inconsistent
- **THEN** no financial write occurs.

#### Scenario: Interrupted or completed operation
- **WHEN** an intent is incomplete or the identical operation is retried after verified completion
- **THEN** the former stops for investigation and the latter verifies without repeating the deletion.
