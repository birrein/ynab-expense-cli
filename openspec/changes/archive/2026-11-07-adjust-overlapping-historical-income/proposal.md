## Why
A legacy income aggregate can overlap individually verified statement rows; recording both overstates the balance, while deleting the aggregate would also remove non-overlapping amounts.

## What Changes
- Permit a guarded partial adjustment of a historical income aggregate by the sum of explicitly verified, distinct income components.
- Preserve component transactions and the aggregate's other fields and residual amount; audit evidence, backup and independent verification.

## Capabilities
### New Capabilities
- `actual-partial-historical-income-deduplication`: Remove verified overlap from an existing historical income aggregate without disturbing its residual.

### Modified Capabilities
None.

## Impact
Actual daily adapter, its tests, runbook, and financial audit state. No changes to remote configuration or budgets other than the authorized correction.
