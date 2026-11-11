## ADDED Requirements

### Requirement: Distinguish statement-confirmed nearby expenses
The adapter SHALL allow a nearby equal-amount destination expense only when an explicit statement-backed candidate identifies the migrated purchase and every nearby peer with exact peer transaction snapshots, different merchant identities, distinct bank references and aligned dates from separate rows of the same statement. A plan SHALL bind the peer evidence and snapshots into its existing hash; apply SHALL preserve the peers and retain all migration safeguards. Missing, stale, extra, duplicated or ambiguous peer evidence SHALL fail closed. The operator SHALL inspect the statement and source documents; the adapter SHALL NOT claim it parsed the statement.

#### Scenario: Different merchants with the same billed amount
- **WHEN** the same statement identifies two distinct reference numbers, dates and merchants, and every nearby peer exactly matches an independent transaction
- **THEN** plan permits migration while preserving those peer transactions and all source protections.

#### Scenario: Ambiguous or changed peer
- **WHEN** any nearby peer is omitted, unexpected, stale, shares the destination merchant or reuses a statement reference
- **THEN** plan and apply reject the migration before a financial write.
