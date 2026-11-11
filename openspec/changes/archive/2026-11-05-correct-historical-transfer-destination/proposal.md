## Why
Historical transfers may have the wrong destination even when both bank receipts identify the real chain, causing duplicated credits and incorrect balances.
## What Changes
- Permit evidence-backed correction of an existing historical transfer destination without creating a duplicate.
- Preview, back up, preserve the other transfer in the chain, synchronize and independently verify.
## Capabilities
### New Capabilities
- `actual-historical-transfer-destination`: Correct a historical transfer's destination with exact identity and evidence.
### Modified Capabilities
None.
## Impact
Actual adapter, tests, operational runbook, and private audit.
