## Purpose

Replace a historical split purchase total with its billed card installments while preserving item-level totals and other financial records.

## ADDED Requirements

### Requirement: Require complete evidence and exact item allocation

The adapter SHALL require an exact snapshot of an unowned, unreconciled, uncleared historical split purchase, its purchase receipt and a complete consecutive series of already billed installments with distinct verified statements and stable unique bank sources. The operator MUST independently verify the receipt and every statement. Each installment SHALL include an explicit allocation for every original child; each row SHALL sum to the billed amount and each child's allocations SHALL sum exactly to its original amount. For proportional allocation, each entry MUST differ from its exact proportional value by less than one smallest currency unit (one peso for CLP, one cent for USD). The adapter SHALL reject mismatched identity, partial or future series, malformed allocations, changed source data, duplicates, ownership conflicts or unsupported transfer children before writing.

#### Scenario: Complete valid series
- **WHEN** all statements, purchase, original split and proportional allocation match and no duplicate exists
- **THEN** the preview displays the proposed installment series and each item allocation without mutation.

#### Scenario: Invalid or incomplete allocation
- **WHEN** any original item, total, month, statement, source, category, ownership or allocation conflicts
- **THEN** the adapter refuses to write.

### Requirement: Preserve line identity, totals and unrelated state

On a verified commit the first billed installment SHALL preserve the original parent and child IDs; all installments SHALL preserve each original child's category, payee and description, and the sum for each child and for the parent SHALL equal the original. The operation SHALL preserve all unrelated transactions and metadata, categories, schedules, rules and total account balances. It SHALL store the original snapshot and evidence in a private durable audit and independently verify the complete budget after synchronization.

#### Scenario: Verified replacement
- **WHEN** a valid preview is committed
- **THEN** the original split becomes the first installment, the rest appear once, and no aggregate total is added on top.

### Requirement: Fail closed on interruption and exact retry

The adapter SHALL require a live owned lease, lock, backup and revalidation, then persist a pending audit before writing. A matching complete audit and independently unchanged series SHALL permit an idempotent retry without any writes. A pending audit, changed original, unexpected partial write, missing audit or inconsistent readback SHALL stop further writes and require manual investigation without changing source identifiers.

#### Scenario: Interrupted replacement
- **WHEN** any write or verification fails after a pending audit is stored
- **THEN** retry is blocked and the original backup and stable identities remain available for investigation.
