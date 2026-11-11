## Why

Historical own-account transfers can aggregate several separately evidenced bank movements. The existing retirement operation requires the individual pairs to exist already, preventing a safe replacement without duplicated balances.

## What Changes

- Add an audited, fail-closed replacement of an exact historical reciprocal pair with individually sourced transfers whose sum matches it.
- Verify an unchanged final balance and unrelated records, and stop on interrupted writes.

## Capabilities

### New Capabilities

- `actual-historical-aggregate-transfer-replacement`: Replace one historical transfer pair with individually evidenced components.

### Modified Capabilities

None.

## Impact

Actual adapter, its tests and runbook; no changes to unrelated budgets or financial entries.
