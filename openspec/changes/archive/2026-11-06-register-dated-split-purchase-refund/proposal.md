## Why

A verified multi-category grocery purchase and a later settled global discount cannot currently be represented on both bank dates without losing the category allocation or inventing product-level refund facts.

## What Changes

- Register a negative split purchase and a positive split refund in the same account on their evidenced dates.
- Require complete receipt categories, independent charge and refund sources, statement evidence and a clearly disclosed proportional allocation when the provider does not allocate its global discount.
- Use exact money arithmetic, duplicate checks, durable pending audit, backup, synchronization and independent verification; a partial operation stops for investigation.

## Capabilities

### New Capabilities

- `actual-dated-split-purchase-refund`: Record a category-backed purchase and separately dated global refund as linked split transactions.

### Modified Capabilities

None.

## Impact

Local Actual adapter, tests and runbook. Existing expense and refund workflows remain unchanged.
