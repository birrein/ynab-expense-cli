# actual-marketplace-held-refund Specification

## Purpose
Reconstruct a canceled marketplace sale and a temporary hold using documented dated cash movements without treating reserved money as consumption.

## Requirements

### Requirement: Evidence-bound cancellation reconstruction
The adapter SHALL accept only an independently reviewed canceled sale, provider release report, claim evidence and bank statements with a unique payment reference, verified existing charges and exact timestamps, dates and amounts. The adapter SHALL require independently reviewed current dashboard definitions and SHALL NOT apply if their filters cannot be safely composed. It SHALL preview a sale credit and the separately evidenced settlement components in a dedicated canceled-sale income category, with verified exclusions from affected sign-based dashboard widgets, and a temporary reserve as reciprocal transfers to and from a dedicated zero-opening on-budget holding account. The settlement components SHALL net exactly to reverse the sale credit; the reserve transfers SHALL net to zero. The operator SHALL verify the source data; declared IDs alone SHALL NOT prove it. Existing charges and unrelated transactions SHALL remain unchanged.

#### Scenario: Reconstruct a supported cancellation
- **WHEN** the verified release, claim, dated settlement entries, reserve, existing charges and opening and closing evidence agree without overlapping sources or potential duplicate transactions
- **THEN** preview describes all postings, their category, native reciprocal transfers, expected balances and account lifecycle without writing.

#### Scenario: Conflict or unsupported attribution
- **WHEN** a source, snapshot, amount, date, account, report classification, category, existing charge or potential duplicate is missing or conflicts
- **THEN** the operation SHALL stop before writing.

### Requirement: Safety, verification and recovery
The adapter SHALL bind execution to the complete preview and candidate, require the active lease and lock, create backup and revalidate before writing, reserve sources in a pending audit, synchronize and independently verify all new transaction fields, account state, reciprocal links, category and dashboard filters, date-specific balances, and unchanged unrelated data before completing the audit. The holding account SHALL start and finish at zero and SHALL be closed only after its final zero balance and transfers are independently verified. An interrupted operation SHALL remain pending and refuse retries until investigated; an identical completed retry SHALL verify without writing.

#### Scenario: Changed budget or partial write
- **WHEN** a candidate, source, prior charge, account or budget differs from preview, or a pending audit exists
- **THEN** no additional transaction or account SHALL be created and the audit identifies the backup for investigation.

#### Scenario: Completed reconstruction
- **WHEN** the complete operation succeeds
- **THEN** the sale and its settlement net to zero in the same income category, retained funds are not counted as expense, canceled-sale entries are excluded from affected income, expense and cash-flow dashboard widgets, affected daily balances agree with independently reviewed statements, the holding account is closed at zero, and all prior records remain unchanged.
