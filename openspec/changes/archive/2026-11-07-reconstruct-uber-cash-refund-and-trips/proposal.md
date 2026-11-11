## Why

A canceled Uber Eats order was charged to CMR and refunded to Uber Cash rather than to the card. Four subsequent rides used Uber Cash, one jointly paid with an already-recorded card charge. Neither the card funding nor the wallet-paid portions are yet represented; the wallet's opening balance is unknown.

## What Changes

- Add an evidence-gated, partial Uber Cash reconstruction that records the card-to-wallet economic effect of the confirmed cancellation and the verified wallet portions of four rides without posting the canceled meal as consumption.
- Link a mixed-payment receipt to its existing card expense and newly recorded wallet portion without treating the shared receipt as another purchase or replacing the existing source record.
- Preserve the unknown opening explicitly and do not claim that the partial wallet balance is a bank-reconciled actual balance; defer other unverified wallet credits.
- Require full snapshots, immutable sources, pending audit, exact plan, backup, independent verification and fail-closed interrupted recovery.

## Capabilities

### New Capabilities
- `actual-partial-uber-cash-reconstruction`: Reconstruct documented card funding and subsequent wallet-funded rides without assuming an opening balance.

### Modified Capabilities

## Impact

Actual adapter, one clearly named partial wallet account, card balance and audited transaction sources; unrelated budgets, Gmail state and existing card transaction remain unchanged until independently verified.
