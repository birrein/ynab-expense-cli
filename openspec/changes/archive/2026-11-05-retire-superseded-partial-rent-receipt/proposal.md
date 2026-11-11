## Why

A preliminary partial receipt and its final corrected version can be imported as separate expenses even though the bank shows only one final payment.

## What Changes

- Retire a partial-receipt duplicate only with matching receipt identity, both documents and a bank-backed final charge.

## Capabilities

### New Capabilities

- `actual-superseded-partial-expense`: Safely retire an earlier partial version of the same expense.

### Modified Capabilities

## Impact

Actual historical duplicate retirement validation and tests; no direct database writes.
