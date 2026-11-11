## Why
The existing single-schedule amendment cannot move a rounding peso between two schedules while preserving the purchase total at every validated plan.

## What Changes
- Add a guarded series rebalance that previews and updates two or more schedule amounts and their rules as one verified operation.
- Preserve the complete series, original sources, purchase total, unrelated records, backup and recovery evidence.

## Capabilities

### New Capabilities
- `actual-installment-series-rebalance`: Verify and rebalance installment schedules while preserving the confirmed purchase total.

### Modified Capabilities

## Impact
Actual adapter and tests, OpenSpec, private audit and the specified CLP schedules; no other budget or writer.
