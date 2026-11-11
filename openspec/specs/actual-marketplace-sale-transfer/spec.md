# actual-marketplace-sale-transfer Specification

## Purpose
Reconstruct an evidenced marketplace settlement and its own-account bank transfer while preserving the original bank movement.

## Requirements

### Requirement: Evidence-bound settlement and transfer
The adapter SHALL require independently reviewed marketplace sale, wallet statement and bank transfer evidence, an exact snapshot of the existing bank credit, distinct active own accounts, the settlement amount and date, stable unique source identifiers, and an existing income category. It SHALL propose one net settlement income and convert the bank credit to a native reciprocal transfer without changing its identity, amount or date. It SHALL preserve useful historical notes and provenance and SHALL NOT infer fees or profit.

#### Scenario: Supported settlement
- **WHEN** sale, wallet release, own transfer, bank statement and exact historical credit agree and no duplicate or source conflict exists
- **THEN** preview reports the exact income and conversion while leaving the budget unchanged.

#### Scenario: Conflicting or incomplete evidence
- **WHEN** a source, account, identity, date, amount, snapshot, category, existing transaction or competing movement conflicts or lacks corroboration
- **THEN** the operation refuses to write.

### Requirement: Safe conversion and retry
The adapter SHALL bind execution to the preview, require a lease and lock, back up and revalidate before writing, persist a pending audit, synchronize and independently verify all resulting fields, reciprocal links, balances and unrelated budget state before completing the audit. A partial operation SHALL fail closed pending investigation and an exact completed retry SHALL verify the result without writing again.

#### Scenario: Verified conversion
- **WHEN** a supported preview is applied to unchanged state
- **THEN** exactly one income and one reciprocal origin debit appear, the existing credit is converted in place, all account balances remain unchanged, and the audit records their identities.

#### Scenario: Interruption or stale preview
- **WHEN** an operation is incomplete or the previewed budget or candidate changed
- **THEN** the adapter stops without creating another movement and requires investigation or a fresh preview.
