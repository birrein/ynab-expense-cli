## Why

Statements can post a single own-account transfer on different dates in each account. Giving both legs the same date makes one account's daily and month-end balance disagree with its statement.

## What Changes

- Add an audited operation for one historical reciprocal transfer with independently evidenced posting dates.
- Preserve transfer IDs, amounts, accounts, all non-date data and final balances; verify daily balances and all unrelated state.
- Require full snapshots, two distinct bank statements and the payment receipt, and reject ambiguous or conflicting evidence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-transfer-date`: support individually evidenced dates for the two existing transfer legs.

## Impact

Actual daily adapter, tests, runbook, and historical transfers in the user's Actual budget. No API or dependency change.
