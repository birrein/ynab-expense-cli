## Why

An interrupted sync may leave every installment date updated while the durable audit is still pending. The adapter currently blocks a repeat of that series correction until manual investigation, but provides no verified way to complete that audit without editing transactions again.

## What Changes

- Add a narrow recovery path for an exact pending series candidate when an independent full-budget read matches the original backup except for exactly the intended date changes.
- Refuse recovery for partial or inconsistent changes and never replay transaction updates or replace source identities.
- Preserve lease, lock, backup provenance, independent verification and a durable record of the recovery.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-historical-installment-series-dates`: Permit verification-only completion of an interrupted pending audit under exact full-budget checks.

## Impact

The Actual daily adapter, installment-series audit tests, runbook and OpenSpec contract. No changes to the Actual server or other budgets.
