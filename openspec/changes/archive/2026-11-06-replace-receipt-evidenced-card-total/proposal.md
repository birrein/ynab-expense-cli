## Why

Some historical card purchases were recorded at their total without an installment tag, although the purchase receipt and complete bank statements establish the installment series. The existing guard blocks correcting these totals without adding misleading historical metadata.

## What Changes

- Permit an explicit receipt-evidence alternative for an untagged original, bound to the exact transaction and documented card purchase.
- Preserve the existing tagged path and all exact-series, duplicate, audit, backup and independent verification protections.
- Require the operator to inspect the underlying receipt and each statement; structured declarations do not authenticate documents.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-card-total-replacement`: accept documented receipt evidence as an alternative to an existing installment tag.

## Impact

The Actual historical-total adapter, its tests and operator runbook. No server, dependency, budget or account changes are required by implementation.
