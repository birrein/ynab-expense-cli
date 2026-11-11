## Why

Historical manual dates can be later than the verified bank posting, leaving daily balances wrong although the expense and final balance are correct. The adapter currently cannot correct that direction for expenses.

## What Changes

- Add an explicitly selected, tightly bounded earlier-date mode for a single eligible historical expense with a covering statement and independent receipt agreeing on the posting date.
- Preserve the existing protections, evidence checks, date-only mutation, audit, backup and independent verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-expense-statement-date`: Support earlier bank posting dates with explicit matching evidence.

## Impact

Actual daily adapter, its unit and official API offline tests, operational runbook and the expense-date specification. Existing modes retain their current behavior.
