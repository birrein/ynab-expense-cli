## Purpose

Integrate a verified portion of a historical card account into its principal account while preserving unresolved rows and prior evidence.

## ADDED Requirements

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
