# actual-statement-fx-expense-migration Specification

## Purpose
Correct an existing sourced card expense when the statement bills it in another budget currency, preserving evidence and preventing duplicate spending.

## Requirements

### Requirement: Preview only a verified cross-currency expense migration
The adapter SHALL require explicit operator-reviewed original transaction and ledger identity, full Gmail source aliases, original amount, exact statement-billed USD amount and statement identity, and active mapped destination account, payee and category. It SHALL accept only a simple, unreconciled, untransferred, unscheduled ledger-owned CLP expense, reject ambiguous or duplicated sources and unrelated references, and bind the review to both complete budget snapshots and ledger.

#### Scenario: Exact statement-backed purchase
- **WHEN** the original expense, independent receipt and card statement establish the same purchase and exact billed amount
- **THEN** plan shows the original and destination identities, amounts, provenance and a plan hash without writing.

#### Scenario: Changed or ambiguous evidence
- **WHEN** a snapshot, identity, ledger alias, existing source, destination or amount conflicts or is stale
- **THEN** the adapter stops without a financial write.

### Requirement: Preserve lineage and independently verify both budgets
The adapter SHALL require an owned run and exclusive lock, back up both budgets, revalidate the reviewed hash, and durably record a pending intent before mutation. It SHALL retain original source IDs, original transaction and complete prior audit in immutable lineage, write the billed expense with the same primary imported ID, remove only the old expense, and independently verify both full snapshots, dashboard data and exact balance deltas before atomically updating all ledger aliases and completing audit. An identical completed retry SHALL verify without writing; pending or ambiguous outcomes SHALL stop for inspection.

#### Scenario: Successfully migrated expense
- **WHEN** both budget readbacks match the expected change
- **THEN** the destination contains one sourced purchase, the original no longer contains it, and the complete original audit and notes remain accessible.

#### Scenario: Partial failure
- **WHEN** a write, synchronization, ledger update or verification fails after intent
- **THEN** the adapter retains both backups and pending intent and refuses all further financial mutations until investigated.

### Requirement: Prevent cross-budget source replay
The adapter SHALL block ordinary or other candidate operations from recreating a migrated source, reusing a migrated transaction identity or overriding its audit. The dedicated migration operation SHALL allow a read-only exact retry to verify the current destination, and stale currency or lineage SHALL be rejected rather than silently treated as a new purchase.

#### Scenario: Original email is processed again
- **WHEN** the same source is proposed as a new expense in the original budget after migration
- **THEN** the adapter returns review without writing, regardless of date or amount similarity.

### Requirement: Distinguish statement-confirmed nearby expenses
The adapter SHALL allow a nearby equal-amount destination expense only when an explicit statement-backed candidate identifies the migrated purchase and every nearby peer with exact peer transaction snapshots, different merchant identities, distinct bank references and aligned dates from separate rows of the same statement. A plan SHALL bind the peer evidence and snapshots into its existing hash; apply SHALL preserve the peers and retain all migration safeguards. Missing, stale, extra, duplicated or ambiguous peer evidence SHALL fail closed. The operator SHALL inspect the statement and source documents; the adapter SHALL NOT claim it parsed the statement.

#### Scenario: Different merchants with the same billed amount
- **WHEN** the same statement identifies two distinct reference numbers, dates and merchants, and every nearby peer exactly matches an independent transaction
- **THEN** plan permits migration while preserving those peer transactions and all source protections.

#### Scenario: Ambiguous or changed peer
- **WHEN** any nearby peer is omitted, unexpected, stale, shares the destination merchant or reuses a statement reference
- **THEN** plan and apply reject the migration before a financial write.
