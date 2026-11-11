## Why

An issuer may confirm a card payment by receipt without making its historic statement available. A separately reviewed destination receipt and the origin bank statement can establish the two posting dates without inventing a statement identifier.

## What Changes

- Add an explicit destination-receipt alternative for an existing one-leg transfer date correction.
- Preserve the independent origin receipt, duplicate, source ownership, backup, audit and independent verification safeguards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-transfer-date`: support an independently verified destination issuer receipt instead of a destination statement for a single-leg correction.

## Impact

Actual adapter, tests, runbook and historical-transfer specification; no transaction creation or dependency changes.
