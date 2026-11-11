## Why
A preliminary historical split can duplicate a separately verified settled Uber Eats order with a different final amount. Existing deduplication correctly refuses mismatched splits, leaving the account overstated despite distinctive product evidence and a bank-settled receipt.

## What Changes
- Add a narrow, evidence-backed operation to retire a historical split while preserving a separately registered final Uber Eats split.
- Require the provider export, exact unique order and distinctive historical item, source receipt, statement, immutable snapshots, preview, audit, backup and independent verification.

## Capabilities

### New Capabilities
- `actual-evidenced-uber-split-dedup`: Retire an unowned historical duplicate split only when its distinctive item matches a unique completed exported order and a bank-verified retained split.

### Modified Capabilities

## Impact
Actual daily adapter, focused tests, OpenSpec and operating runbook. No changes to budgets except the explicitly verified duplicate retirement.
