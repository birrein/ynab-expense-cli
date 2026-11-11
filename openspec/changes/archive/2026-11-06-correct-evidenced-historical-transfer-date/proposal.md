## Why

A historical linked transfer can have an incorrect date on both legs even when its bank statement and payment receipt identify the actual date.

## What Changes

- Add a narrowly evidenced date correction preserving the exact transfer IDs, reciprocal link, clearing flags and balances.

## Capabilities

### New Capabilities

- `actual-historical-transfer-date`: Correct the date of a verified existing transfer pair.

### Modified Capabilities

None.

## Impact

Actual adapter, tests and runbook. No new transfer or account is created.
