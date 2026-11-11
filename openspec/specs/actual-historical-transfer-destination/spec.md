# actual-historical-transfer-destination Specification

## Purpose
Safely repair a misdirected historical transfer using bank evidence without duplicating a payment.

## Requirements

### Requirement: Verify historical transfer before and after destination correction
The adapter SHALL require an exact historical transfer pair and an independently evidenced downstream transfer, preserve all other records, and prove both leg identity and account balances after synchronization.
#### Scenario: Authorized correction
- **WHEN** the two old transfer legs, downstream transfer and destination match the supplied identities and evidence
- **THEN** the adapter backs up the budget, changes only the destination through the official API, synchronizes, independently reads the budget and records the audit.
#### Scenario: Identity, ledger or downstream conflict
- **WHEN** any supplied identity or account differs, a source-ledger record owns the transfer, the downstream pair is absent, or either old leg is reconciled
- **THEN** the adapter rejects the correction without writing.
#### Scenario: Exact retry
- **WHEN** the same correction is retried following a completed write
- **THEN** the adapter verifies the corrected pair and restores its audit without a further financial mutation.
