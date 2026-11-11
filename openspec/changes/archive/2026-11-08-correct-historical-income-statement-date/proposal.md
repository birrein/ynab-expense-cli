## Why

Historical income can have an initiation or estimated date different from the bank posting date, causing daily and monthly balances to diverge.

## What Changes

- Add an audited correction of one unique existing historical income to the evidenced statement posting date.
- Require the operator to review both surrounding statements, same payer, amount, account and absence of competing entries; preserve identity, classification and final balance.

## Capabilities

### New Capabilities

- `actual-historical-income-statement-date`: safe date-only correction of an evidenced historical income.

### Modified Capabilities

None.

## Impact

Actual adapter, tests and runbook. No dependency or external API change.
