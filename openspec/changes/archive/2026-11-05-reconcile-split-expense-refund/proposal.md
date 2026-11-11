## Why

A split purchase recorded at its final net amount conceals the earlier gross card charge and later bank refund, producing incorrect daily account balances.

## What Changes

- Add an evidence-gated operation to reconstruct the gross split and a separately dated refund while preserving transaction identities and source provenance.
- Preview, back up, guard against interrupted writes and duplicates, synchronize and independently verify the whole budget and ledger.

## Capabilities

### New Capabilities

- `actual-split-purchase-refund`: Reconstruct a source-ledger split purchase and an evidenced, category-specific bank refund.

### Modified Capabilities

None.

## Impact

Actual daily adapter, policy tests, runbook and Actual budget data for explicitly selected transactions.
