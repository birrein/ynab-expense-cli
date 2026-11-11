## Why
The duplicate guard rejects a verified transfer when another equal-amount transfer from the same card to a different own account is already recorded nearby. Both rows and both destinations can be evidenced without weakening duplicate protection.

## What Changes
- Permit a narrowly evidenced same-origin exception for an exact prior pair already registered and independently verified in the cashflow ledger.
- Require a common origin statement, distinct recipient statement, exact prior snapshots, distinct receipts and full conflict coverage; preserve the prior pair and sources.
- Retain lease, backup, synchronization, independent readback and fail-closed behavior.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-confirmed-cashflows`: admit a separately evidenced same-origin transfer when the sole conflict is a verified ledger-owned pair to another destination.

## Impact
`scripts/actual-cashflow.mjs`, focused tests, the operational runbook, and the Actual cashflow ledger audit. No budget migration or remote configuration change.
