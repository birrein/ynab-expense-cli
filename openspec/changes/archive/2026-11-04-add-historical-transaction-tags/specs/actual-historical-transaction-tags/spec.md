## Purpose

Allow explicitly authorized tags on identifiable historical Actual expenses without fabricating Gmail provenance.

## ADDED Requirements

### Requirement: Bounded historical tag amendment
The adapter SHALL offer a dedicated operation to prepend one authorized tag to a uniquely identified, simple, categorized historical expense absent from the source ledger. It SHALL verify exact transaction ID, account, payee, date, amount, category, imported ID including null, complete original notes and evidence. It MUST reject transfer, split, ledger-associated and ambiguous targets, and preserve every field other than notes.

#### Scenario: Valid historical expense
- **WHEN** a candidate exactly matches a historical expense and identifies one valid tag
- **THEN** the preview shows the tag before the original notes and preserves all other content.

#### Scenario: Identity mismatch
- **WHEN** identity, original notes or ledger association differs
- **THEN** the adapter rejects the request without writing.

### Requirement: Verified and recoverable write
The adapter SHALL require a run lease, write lock, prior backup, synchronized revalidation, independent full-budget readback and private durable audit; retries of the identical candidate SHALL verify and recover the audit without duplicating a tag.

#### Scenario: Interrupted write
- **WHEN** the intended notes already exist after an interrupted attempt
- **THEN** the adapter independently verifies the result and records recovery without another write.
