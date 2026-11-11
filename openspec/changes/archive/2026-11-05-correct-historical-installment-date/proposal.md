## Why

A historical installment can be present once with the correct amount but in the wrong billing month, making historical statements and spending reports misleading. Creating another transaction would duplicate the purchase.

## What Changes

- Add a tightly scoped, source-backed correction of the date of an existing historical installment.
- Require exact transaction and neighboring installment identities, original purchase and statement evidence, preview, backup and independent verification.

## Capabilities

### New Capabilities

- `actual-historical-installment-date`: Correct one historical installment date while preserving its identity, amount, category and surrounding series.

### Modified Capabilities

None.

## Impact

The Actual adapter and its Go CLI passthrough, tests, operational runbook and audit state. No bank transaction or scheduled installment is created.
