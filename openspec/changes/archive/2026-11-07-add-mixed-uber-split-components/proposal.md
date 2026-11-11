## Why

A mixed Uber Eats grocery and alcohol order already has a card-paid split, but its separate Uber Cash amount is absent. The existing mixed-payment writer rejects split parents and a receipt already imported in the card account.

## What Changes

- Add an evidence-gated operation for the missing wallet split linked to an existing card split and its original shared Gmail source.
- Preserve the original card parent, children, source ledger and audit; allocate the entire order proportionally and make the new wallet children the exact residual of the original card children.
- Retain exact plan digest, duplicate guards, durable pending intent, backup, independent verification and unknown-wallet-balance limitations.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-partial-uber-cash-reconstruction`: Add a distinct evidence-gated mixed-payment split operation.

## Impact

Actual adapter, tests, runbook and one partial wallet. No historical card split or unrelated financial record changes.
