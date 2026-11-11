## Purpose

Allow independently verified bank credits to affect the correct account balance while preserving unknown categorization for later review.

## ADDED Requirements

### Requirement: Safely record an uncategorized statement credit
The adapter SHALL accept only a positive settled statement credit with an exact active account, date, currency, stable line-level bank source, an independently inspected statement reference, evidence and a nonempty reason for pending classification. It SHALL reject overlapping sources, ambiguous nearby matches and uncertain settlement. The resulting transaction SHALL have no category and remain in Review; the system SHALL NOT classify it as earned income or assign a fictional category.

#### Scenario: Verified credit has no category
- **WHEN** the inspected statement confirms one unique settled credit and the purchase category is unknown
- **THEN** preview proposes one uncategorized credit and execution preserves provenance and Review status.

#### Scenario: Evidence or deduplication fails
- **WHEN** the account, statement, amount, line identity or evidence is incomplete, or any matching source or nearby transaction is ambiguous
- **THEN** no financial write occurs.

### Requirement: Preserve accounting and recovery invariants
Execution SHALL require a current lease, lock, full backup, durable pre-write intent, revalidation and independent full-budget and dashboard readback. It SHALL verify exact balance change and all unrelated state, preserve source links and markers, and block conflicting writes after an interrupted intent. It SHALL exclude the exact unresolved credit from applicable income summary widgets without changing unrelated filters or net-worth calculations. A completed exact retry SHALL be read-only.

#### Scenario: Interrupted credit
- **WHEN** a write is interrupted or its verification fails
- **THEN** the intent and source remain reserved for investigation without changing source identifiers or writing another credit.

#### Scenario: Verified retry
- **WHEN** the exact completed candidate is repeated
- **THEN** it verifies the existing result without creating another movement.

#### Scenario: Income widget cannot be protected
- **WHEN** a relevant income widget cannot express and independently verify an exact-source exclusion
- **THEN** no live financial write occurs.

### Requirement: Resolve only with sufficient evidence
The system SHALL allow a subsequent separately audited category resolution only after the operator verifies the credit's economic nature and category against source evidence; it SHALL preserve the original transaction ID, amount, source and unrelated state. Until resolution it SHALL remain in Review. Before live use, an isolated budget test SHALL document how the uncategorized credit affects balances, budgeting and relevant income and expense reports.

#### Scenario: Purchase attribution remains unknown
- **WHEN** a credit is established but the underlying purchase and category are unverified
- **THEN** the credit remains uncategorized and in Review.

#### Scenario: Category established later
- **WHEN** evidence identifies a valid category and the current transaction and original audit match
- **THEN** the adapter may resolve the category with backup and independent readback, without another credit.
