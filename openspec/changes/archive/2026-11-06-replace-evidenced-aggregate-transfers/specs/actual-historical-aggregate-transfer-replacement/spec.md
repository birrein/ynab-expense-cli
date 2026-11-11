## Purpose

Preserve accurate individually sourced own-account transfers when historical imports grouped them together.

## ADDED Requirements

### Requirement: Replace an evidenced historical aggregate transfer
The adapter SHALL accept only exact reciprocal, simple, unreconciled, unowned historical legs and at least two distinct independently reviewed receipt sources and a statement whose individual amounts sum to the aggregate. The operator MUST inspect the statement and receipts; identifiers alone do not prove their content. The adapter SHALL reject any unaccounted matching transaction, overlapping source or changed field.

#### Scenario: Distinct evidenced operations
- **WHEN** all exact snapshots, accounts, dates, sources and amounts agree with independently reviewed evidence
- **THEN** preview proposes individually sourced linked pairs without writing.

#### Scenario: Conflict or missing evidence
- **WHEN** a source, statement, transaction, component, amount or duplicate check conflicts
- **THEN** no financial mutation occurs.

### Requirement: Audit and independently verify replacement
The adapter SHALL require the active lease and backup, revalidate all state and record a pending audit before mutation, and independently verify each linked pair, unchanged balances and unrelated state before completing the audit. A pending or conflicting audit SHALL block retries; an exact completed retry SHALL verify without another mutation.

#### Scenario: Complete replacement
- **WHEN** the replacement succeeds
- **THEN** the historical pair is absent, every independently sourced pair exists once and balances and unrelated data remain unchanged.

#### Scenario: Interrupted replacement
- **WHEN** any write or verification fails after the pending audit
- **THEN** the adapter refuses subsequent automatic mutation and identifies the audit and backup for investigation.
