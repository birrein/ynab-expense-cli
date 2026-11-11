## Why
A historical own-account transfer summarizes multiple separately evidenced transfers. Recovering the separate rows can duplicate both sides and distort balances.
## What Changes
- Retire the exact historical aggregate pair only when the individually sourced reciprocal transfer pairs sum exactly to it.
- Preserve the historical records in audit and all individual transfers unchanged.
## Capabilities
### New Capabilities
- `actual-aggregate-transfer-deduplication`: retire one corroborated aggregate transfer pair in favor of exact detailed pairs.
### Modified Capabilities
## Impact
Actual adapter, tests, runbook and OpenSpec only.
