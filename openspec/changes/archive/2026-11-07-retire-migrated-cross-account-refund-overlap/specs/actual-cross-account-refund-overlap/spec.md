## Purpose

Preserve one correct net expense when documented purchase and refund produce an overlapping historical gross expense across an audited account migration.

## ADDED Requirements

### Requirement: Resolve a verified migration exception as a net purchase
The adapter SHALL require exact gross and net snapshots in the source and destination of a completed partial migration, the precise excluded gross snapshot, distinct documented purchase and refund references, corroborating receipt sources, matching category, and a positive refund such that gross plus refund equals net. The operator SHALL read all original evidence; identifiers and arithmetic alone do not prove identity. It SHALL reject reconciled, split, transfer, scheduled, owned or altered rows, unsupported references, missing migration audit and any separately recorded refund. The operation SHALL preserve the net transaction exactly, retain the gross snapshot and all source evidence in an audit, and never create a refund or additional expense.

#### Scenario: Reviewed exact overlap
- **WHEN** an exact gross and net pair with matching migration and refund evidence is previewed
- **THEN** the plan SHALL identify both unchanged snapshots, the exact removal and balance impact, and a digest of candidate, budget and relevant ledger state.

#### Scenario: Ambiguity or changed evidence
- **WHEN** identities, accounting, original sources, ledger ownership or migration references conflict
- **THEN** the operation SHALL fail without writing.

### Requirement: Verify retirement and recover safely
The adapter SHALL require the exact plan digest, an owned lease, lock, backup and revalidation, persist a pending audit before mutation, synchronize, and independently verify the entire budget and both account balances before completing the audit. A pending audit SHALL block unrelated financial writes; an identical completed retry SHALL verify without writing.

#### Scenario: Interrupted operation
- **WHEN** mutation or independent verification fails
- **THEN** the pending audit and backup SHALL remain and no automatic retry or unrelated financial write SHALL proceed.

#### Scenario: Completed operation
- **WHEN** independent readback confirms the net row and all unrelated state unchanged and the gross row absent
- **THEN** the audit SHALL be completed and identify the exact superseded migration exception.
