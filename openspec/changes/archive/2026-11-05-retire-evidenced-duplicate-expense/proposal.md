## Why
A bank interest charge and tax were already in historical data with a different date and were reimported from a statement. Removing only the evidenced duplicate is necessary to restore the true account balance and spending.
## What Changes
- Add an exact, statement-backed historical duplicate expense retirement preserving the retained transaction and audit of the removed source.
- Require evidence, identity, backup, no ledger ownership and full readback.
## Capabilities
### New Capabilities
- `actual-historical-expense-deduplication`: retire an evidenced historical duplicate while retaining its bank-backed match.
### Modified Capabilities
## Impact
Actual adapter, tests, documentation and OpenSpec; no server configuration changes.
