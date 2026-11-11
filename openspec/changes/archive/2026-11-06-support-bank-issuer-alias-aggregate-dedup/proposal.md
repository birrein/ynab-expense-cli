## Why

An issuer's historical payee and its separately evidenced statement charges can use different names for the same bank. Existing exact-payee validation prevents retiring a demonstrated duplicate aggregate.

## What Changes

- Permit a narrowly validated Falabella issuer alias when identifying a historical aggregate and its individually sourced bank charges.
- Preserve all existing identity, category, ledger, backup and independent verification safeguards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-aggregate-expense`: Allow the explicitly verified issuer alias for historical bank charge aggregates.

## Impact

Actual adapter aggregate deduplication, tests and operational runbook; no changes to other providers or budgets.
