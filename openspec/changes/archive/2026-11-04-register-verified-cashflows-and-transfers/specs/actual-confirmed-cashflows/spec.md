## Purpose
Safely register verified incoming funds and own-account bank transfers while retaining provenance and avoiding duplicate charges.

## ADDED Requirements

### Requirement: Preview verified cashflows
The adapter SHALL require an explicit currency, account identity, date, integer amount, stable unique source, corroborating evidence and complete source links. Own-account transfers SHALL identify both active accounts in the same budget and be supported by both origin and destination evidence. It SHALL reject ambiguous matches, unsupported currency, existing or potentially duplicate entries and mixed operation fields.

#### Scenario: Transfer preview
- **WHEN** a uniquely verified own-account transfer has no candidate match on either side
- **THEN** preview proposes one native linked transfer without writing.

### Requirement: Audited safe commit
The adapter SHALL require the owning lease and lock, back up before writing, synchronize and independently verify all target fields, reciprocal transfer links, balances and unchanged unrelated financial records. A retry SHALL verify an exact prior result without a duplicate and SHALL stop on any partial or conflicting state.

#### Scenario: Verified paired transfer
- **WHEN** a verified transfer is committed
- **THEN** exactly two reciprocal movements appear with equal and opposite values in the verified accounts and no expense category.

#### Scenario: Source already exists
- **WHEN** the exact source is retried
- **THEN** the adapter verifies the existing result and never creates a second movement.
