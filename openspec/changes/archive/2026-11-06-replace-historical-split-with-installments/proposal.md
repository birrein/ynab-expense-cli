## Why

A historical card purchase may have a correct itemized split but be recorded at its full price even though bank statements bill installments. The existing replacement operation rejects split parents, so correcting dates currently risks duplicating expenses or losing item categories.

## What Changes

- Add an explicit, evidence-backed operation replacing one unowned historical split total with its complete billed series.
- Preserve every original line's category, payee, description and total while allocating amounts across the billed installments without inventing precision.
- Require preview, duplicate checks, exclusive lease, backup, pending audit, synchronization and independent complete readback. Interrupted operations fail closed.

## Capabilities

### New Capabilities

- `actual-historical-split-installment-replacement`: replace an evidenced historical split total with its exact billed installment series.

### Modified Capabilities

None.

## Impact

Actual daily adapter, isolated runtime tests, and financial runbook. Does not change the server, destination budgets or existing replacement behavior.
