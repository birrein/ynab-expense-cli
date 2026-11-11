# actual-partial-historical-account-migration Specification

## Purpose
Integrate a verified portion of a historical card account into its principal account while preserving unresolved rows and prior evidence.

## Requirements

### Requirement: Plan a partial account migration with exact identity
The adapter SHALL accept a source and destination account, a complete exact snapshot or digest, an exact redundant opening, explicit excluded transaction IDs and evidence independently reviewed by the operator. It SHALL reject unsupported records, unexplained overlaps, incomplete transfer pairs, ledger or configuration references it cannot preserve, source ownership conflicts, or a moved total that differs from the opening. It SHALL leave excluded rows and the historical account intact and open.

#### Scenario: Preview a supported partial migration
- **WHEN** all non-excluded historical transactions, exact opening, accounts, source identities and reciprocal transfers pass validation
- **THEN** preview SHALL enumerate or hash the exact changes and show excluded rows, date-specific balance effects and the retained account without writing.

#### Scenario: Ambiguous source or evidence
- **WHEN** any original snapshot, amount, transfer link, source, configuration reference or duplicate conflicts
- **THEN** the adapter SHALL stop without writing.

### Requirement: Audit and independently verify the migration
The adapter SHALL require the exact preview digest, an owned lease and exclusive lock, a private backup and complete revalidation. It SHALL persist a pending audit before any mutation and block other financial writes while pending. It SHALL independently verify the full budget, nested split records, all reciprocal transfers, rules, schedules, categories, notes, source identifiers, cleared flags, excluded rows and account balances before completing the audit.

#### Scenario: Successful migration
- **WHEN** the entire exact plan is applied and an independent readback matches every expected change and invariant
- **THEN** the audit SHALL become complete and an identical retry SHALL only verify without writing.

#### Scenario: Interrupted or conflicting migration
- **WHEN** any batch, readback or audit step fails or the live budget changes unexpectedly
- **THEN** the pending audit and backup SHALL remain, further financial writes SHALL fail closed and no automatic retry SHALL overwrite the partial result.

### Requirement: Verify a subsequently resolved migration exception
A completed migration verification SHALL preserve its original excluded snapshots and recognize a missing excluded expense only if an exact completed, independently verified retirement audit explicitly names that migration and original snapshot, the retained net transaction remains exact, and the retirement's source evidence and backup are present. Any pending, mismatched, duplicated or absent audit SHALL fail closed.

#### Scenario: Exception retired with evidence
- **WHEN** a completed retirement audit matches exactly the absent excluded row and its unchanged net counterpart
- **THEN** the completed migration retry SHALL verify the resolved exception without rewriting either audit.

#### Scenario: Unsubstantiated missing exception
- **WHEN** the excluded row is absent and its retirement audit is missing, pending, conflicting, duplicated or its counterpart changed
- **THEN** migration verification SHALL fail without writing.
