## Why

Some historical installment series are recorded in purchase-month order although statements bill each installment in the following month. Correcting individual dates cannot safely handle overlapping dates or a cleared installment.

## What Changes

- Correct a complete receipt-backed historical installment series together, preserving identifiers, amounts, notes, categories and cleared flags.
- Require a separate statement for every billed installment, exact snapshots, revalidation, backup, pending audit, synchronization and independent verification.

## Capabilities

### New Capabilities

- `actual-historical-installment-series-dates`: Correct all dates of an evidenced historical installment series as a guarded operation.

### Modified Capabilities

None.

## Impact

Actual daily adapter, policy tests and runbook. No financial amounts or cleared states change.
