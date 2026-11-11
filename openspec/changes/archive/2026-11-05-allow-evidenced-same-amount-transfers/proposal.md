## Why

Two independently evidenced own-account transfers can legitimately share a date, amount and destination while originating from different accounts. The existing duplicate guard blocks the second transfer even when a bank statement and separate origin receipts distinguish them.

## What Changes

- Allow a narrowly evidenced exception naming the exact existing reciprocal pair and independent original receipt; all unexplained conflicts continue to require review.
- Preserve source uniqueness, backup, lease, readback and all other duplicate controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-confirmed-cashflows`: Permit an explicitly verified distinct transfer in the narrowly defined case.

## Impact

Actual cashflow adapter, tests and runbook; no bank configuration changes.
