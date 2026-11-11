# actual-partial-historical-income-deduplication Specification

## Purpose
Safely resolve verified overlap between a historical positive aggregate and individual credited bank transactions while preserving the remaining aggregate.

## Requirements

### Requirement: Guarded partial aggregate adjustment
The adapter SHALL permit a historical positive simple income aggregate to be reduced only by the exact sum of distinct separately verified income components in the same account, with full snapshots, linked ledger records, statement references, an evidenced positive residual, and explicit operator evidence. It SHALL reject ambiguous, changed, owned, reconciled, scheduled, transferred, duplicated, or insufficiently evidenced targets or components. The adapter SHALL NOT infer external-document identity from identifiers or arithmetic alone.

#### Scenario: Verified overlap
- **WHEN** the operator has independently verified the statements and the exact aggregate and distinct component snapshots and their ledger entries match the plan
- **THEN** the adapter SHALL propose preserving the aggregate ID and all fields except its amount, reducing it by precisely the sum of components and preserving the positive residual

#### Scenario: Ambiguous ownership or mismatch
- **WHEN** a target or component has changed, lacks a verified ledger record, is duplicated, has the wrong account, or has conflicting audit state
- **THEN** the adapter SHALL reject the operation without writing

### Requirement: Durable and independently verified adjustment
The adapter SHALL require a matching plan, owned lease and lock, backup and durable intent before modification, synchronize, independently download the full budget, and verify the exact change, components, other records, and account balances before completing the audit. A pending intent SHALL NOT trigger an automatic repeat; an exact complete retry SHALL only verify.

#### Scenario: Interrupted write
- **WHEN** an identical candidate has a pending intent or a changed aggregate without a completed matching audit
- **THEN** the adapter SHALL stop for investigation without a further write
