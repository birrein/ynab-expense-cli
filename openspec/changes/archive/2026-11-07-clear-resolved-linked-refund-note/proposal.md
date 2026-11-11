## Why

A pending refund note becomes misleading after its linked purchase and refund are categorized.

## What Changes

- Remove only the exact generated pending-category line during paired category resolution, preserving all source links and remaining text.
- Verify the category and resulting note together in the existing audited operation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-linked-refund-category-resolution`: Clear the generated pending-category note as part of linked resolution.

## Impact

Paired resolution adapter, focused tests and runbook; no amounts or balances change.
