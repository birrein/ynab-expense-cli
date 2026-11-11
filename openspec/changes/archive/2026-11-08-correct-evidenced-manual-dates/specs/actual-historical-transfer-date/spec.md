## ADDED Requirements

### Requirement: Correct a manually entered transfer date from matching evidence
The adapter SHALL allow an explicitly selected correction of both legs of a reciprocal eligible historical transfer by one to seven days forward when the independent receipt and both distinct complete statements agree on the same new date, source and destination accounts and amount. It SHALL reject competing same-amount transfers near either date, stale snapshots, conflicting or owned sources and absent evidence. All existing full-budget, daily-balance, lease, backup, pending-audit and independent readback protections SHALL apply.

#### Scenario: Two statements and a receipt identify the correct date
- **WHEN** both account statements and the receipt identify the same transfer on a date six days after its manual date
- **THEN** the adapter previews and verifies both dates without creating a transfer.

#### Scenario: Conflicting proof or competing transfer
- **WHEN** the receipt or statements disagree, a competing transfer exists, the mode is absent or any other control fails
- **THEN** no write is permitted.
