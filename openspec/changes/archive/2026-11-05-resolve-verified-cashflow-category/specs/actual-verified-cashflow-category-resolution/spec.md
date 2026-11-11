## Purpose
Resolve the category of a verified bank-sourced expense without duplicating it or losing its transaction and evidence provenance.
## ADDED Requirements
### Requirement: Resolve verified cashflow category safely
The adapter SHALL require an exact verified ledger-owned uncategorized expense, an active expense category, explicit evidence, preview, lease, lock, backup and independent full readback. It SHALL change only category and an explicitly matched stale note fragment while preserving all source links, identifiers, tags, amount, date, account and unrelated state. It SHALL update the existing cashflow ledger and record an idempotent audit only after verification.
#### Scenario: Valid resolution
- **WHEN** exact expense and evidence match
- **THEN** classify the existing expense and verify every unrelated field and balance unchanged
#### Scenario: Conflicting or uncertain prior write
- **WHEN** identity or audit differs or a previous unverified write is detected
- **THEN** refuse another write and require inspection
