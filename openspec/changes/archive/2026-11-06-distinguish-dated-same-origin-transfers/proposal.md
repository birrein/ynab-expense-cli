## Why

A verified card-to-wallet transfer may have the same amount as a separately identified historical transfer from the same card on a nearby date. The current guard only accepts a same-day historical pair even when the statement and recipient report independently distinguish both.

## What Changes

Permit the existing narrowly evidenced same-origin exception for an exact reciprocal historical pair within four days, while retaining full conflict coverage, distinct destinations, verified documents, exact snapshots and all write safeguards.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `actual-confirmed-cashflows`: support a separately verified same-origin transfer on a nearby date.

## Impact

Cashflow classifier, tests and runbook. No changes to other budgets or transaction identities.
