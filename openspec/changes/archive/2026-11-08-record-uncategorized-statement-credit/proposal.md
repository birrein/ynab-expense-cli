## Why

A settled bank-statement credit can be confirmed even when the related purchase and category cannot be established. The existing cashflow path requires an income category, risking a false income classification or omission of a real balance movement.

## What Changes

- Allow an independently inspected positive statement credit to be recorded with no category and an explicit review reason.
- Preserve stable bank and statement provenance, conservative duplicate detection, lease, backup and independent verification.
- Support a separately audited later classification only after evidence identifies the appropriate category and economic nature.
- Verify the effect on budget and reports in an isolated copy before using the feature on actual finances.

## Capabilities

### New Capabilities

- `actual-uncategorized-statement-credit`: Safely record and subsequently resolve verified uncategorized statement credits.

### Modified Capabilities

None.

## Impact

Actual daily adapter, private ledger, tests and runbook. No changes to bank accounts, user budgets other than the authorized transaction, or daily window markers.
