## ADDED Requirements

### Requirement: Recover a fully applied interrupted series audit
The adapter SHALL provide an explicit verification-only recovery for an exact pending series correction. Under an active lease and exclusive lock, it SHALL validate the stored candidate and backup, independently download the live budget, and compare the entire result against the pre-write snapshot allowing only the exact intended dates. It SHALL preserve the original backup and record verified recovery without updating transactions. A partial series, changed candidate, missing backup, unrelated change or failed download SHALL leave the audit pending and block recovery.

#### Scenario: Interrupted sync after every date was applied
- **WHEN** the stored pending candidate and backup agree and an independent read matches the complete intended budget transformation
- **THEN** the adapter records the audit as complete with original provenance and performs no financial write.

#### Scenario: Partial or conflicting recovery
- **WHEN** any installment is missing or has an unexpected date or field, or any other budget data differs from the backup
- **THEN** the adapter preserves the pending audit and performs no financial write.

#### Scenario: Exact recovery retry
- **WHEN** an already completed recovery is retried with its identical candidate
- **THEN** the adapter verifies the stored recovery and current state without applying the series again.
