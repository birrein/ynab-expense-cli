## Purpose

Safely correct one evidenced amount in a historical split while preserving every unrelated transaction field and component.

## ADDED Requirements

### Requirement: Correct a verified historical split amount
The adapter SHALL require the exact prior parent and all child identities, an identified child, an independently verified statement and itemized merchant evidence, a net total equal to the corrected children, and a nonempty explanation. It SHALL reject reconciled, scheduled, transferred, ledger-owned, conflicting or partially changed transactions. The write SHALL require the owning lease and lock, prior full backup and fresh revalidation, and SHALL independently verify that only the identified child and parent amounts and corresponding account balance changed.

#### Scenario: One verified category transcription error
- **WHEN** the exact split and evidence identify the corrected component and net amount
- **THEN** preview shows the correction and apply verifies the original identities, unchanged other fields and exact balance delta.

#### Scenario: Changed or unsupported state
- **WHEN** the old split differs, its source is ledger-owned, or the change cannot be proved
- **THEN** the adapter stops without a financial write.

#### Scenario: Retry after audited success
- **WHEN** the same audited candidate is retried and the corrected state is exact
- **THEN** the adapter verifies it without another write.

#### Scenario: Unverified interruption
- **WHEN** the split changed but no matching audit exists
- **THEN** the adapter stops for manual inspection of the backup and live state.
