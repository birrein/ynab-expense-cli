## Why

A transfer can be initiated before month end but be posted by both banks in the next month. Using the initiation date in both accounts makes their statement balances wrong.

## What Changes

- Allow the audited posting-date operation to align both existing legs to a later, identical bank posting date supported by both statements and the original receipt.
- Preserve IDs, amounts, reciprocal links and all unrelated data; retain atomic-intent audit, backup and independent verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-transfer-date`: safely align both legs with a shared later bank posting date.

## Impact

Actual adapter, tests and runbook. No API or dependency change.
