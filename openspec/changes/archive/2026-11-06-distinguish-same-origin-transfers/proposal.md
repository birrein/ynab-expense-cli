## Why
A statement can show two same-day, same-amount card transfers to different own accounts. An existing historical transfer currently blocks the other even when the bank and recipient independently identify both rows.

## What Changes
- Permit only a precisely evidenced distinct same-origin transfer where the sole collision is an exact existing reciprocal pair to a different account.
- Preserve ordinary duplicate checks, all source identities and the existing pair; audit the exception and independently verify the result.

## Capabilities
### New Capabilities


### Modified Capabilities
- `actual-confirmed-cashflows`: permit narrowly evidenced same-origin transfers to distinct destinations.

## Impact
Cashflow classification, tests, audit and operator runbook; no server, budget or dependency configuration changes.
