## MODIFIED Requirements

### Requirement: Correct a verified historical split amount
The adapter SHALL require the exact prior parent and all child identities, one or more uniquely identified children, an independently verified statement and itemized merchant evidence, a net total equal to the corrected children, and a nonempty explanation. It SHALL reject reconciled, scheduled, transferred, ledger-owned, conflicting or partially changed transactions. The write SHALL require the owning lease and lock, prior full backup and fresh revalidation, and SHALL independently verify that only the identified child amounts, parent amount and corresponding account balance changed. Existing single-child candidates SHALL remain compatible.

#### Scenario: One verified category transcription error
- **WHEN** the exact split and evidence identify the corrected component and net amount
- **THEN** preview shows the correction and apply verifies the original identities, unchanged other fields and exact balance delta.

#### Scenario: Several components require correction
- **WHEN** evidence supports explicit new amounts for multiple distinct existing children and the new parent equals their sum with all unchanged children
- **THEN** one preview and one audited write update those amounts and preserve every other field.

#### Scenario: Invalid multi-child input
- **WHEN** identifiers repeat, a child is absent or unchanged, formats are mixed, an amount is invalid, or the sum differs
- **THEN** the adapter stops without a financial write.

#### Scenario: Changed or unsupported state
- **WHEN** the old split differs, its source is ledger-owned, or the change cannot be proved
- **THEN** the adapter stops without a financial write.

#### Scenario: Retry after audited success
- **WHEN** the same audited candidate is retried and the corrected state is exact
- **THEN** the adapter verifies it without another write.

#### Scenario: Unverified interruption
- **WHEN** the split changed but no matching audit exists
- **THEN** the adapter stops for manual inspection of the backup and live state.
