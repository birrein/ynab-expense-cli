## Why
A historical split can be assigned to the wrong card even when statements and receipt identify its true account. Recreating it would risk duplicate expenses and lost identity.

## What Changes
- Permit narrowly evidenced correction of a historical split's account using Actual's official API.
- Preserve identity, children, categories and provenance; verify both account balances and all other data independently.

## Capabilities
### New Capabilities
- `actual-historical-split-account`: Evidence-backed correction of the account of a historical split.

### Modified Capabilities
None.

## Impact
Actual daily adapter, tests, local financial audit ledger; no unrelated budgets or database access.
