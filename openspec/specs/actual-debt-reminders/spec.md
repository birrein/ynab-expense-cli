# actual-debt-reminders Specification

## Purpose
Make confirmed future debt obligations visible without prematurely recording principal or interest as spending.

## Requirements

### Requirement: Non-posting debt reminders
The adapter SHALL permit a source-backed series of future debt installment reminders with no assigned category and automatic posting disabled, without modifying posted transactions or balances.
#### Scenario: Confirmed future obligations
- **WHEN** the user has confirmed future installment dates and amounts and evidence identifies the underlying debt
- **THEN** the adapter previews, backs up, creates non-posting schedules and independently verifies schedules, rules and unchanged balances.
#### Scenario: Partial or conflicting series
- **WHEN** the series is partially present, contains duplicates, or differs from the candidate
- **THEN** the adapter stops for review without creating more schedules.
#### Scenario: Exact retry
- **WHEN** all intended reminders already match exactly
- **THEN** the adapter verifies the existing series without creating duplicates.
