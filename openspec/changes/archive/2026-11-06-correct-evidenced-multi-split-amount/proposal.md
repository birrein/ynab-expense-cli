## Why

A billed card total can differ from a historical split by a rounding amount allocated across multiple categories. The current operation changes only one component, preventing evidence-based proportional corrections while preserving the split.

## What Changes

- Extend the historical split amount operation to accept a unique list of explicit child amount corrections in one operation, keeping its existing single-child form compatible.
- Validate the exact prior split, sum and all safety invariants, and preserve backup, lease, independent readback and audit behavior.
- Document and test multiple-child success, invalid candidates, unchanged unrelated fields, interruption and idempotent retry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-split-amount`: allow evidenced correction of multiple identified children and their parent in one audited operation.

## Impact

`scripts/actual-split-amount.mjs`, its tests and the Actual Gmail runbook. Existing transaction identity, categories, source ownership and current single-child candidate format remain unchanged.
