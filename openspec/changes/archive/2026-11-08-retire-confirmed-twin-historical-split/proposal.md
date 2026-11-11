## Why

Two older split transactions may represent one bank-confirmed purchase while having different dates and payee fields. The existing split deduplicator only compares an old split to separately recorded ledger-owned components and cannot safely handle two matching historical splits.

## What Changes

- Add a narrowly evidenced, user-confirmed workflow for retiring one of two identical historical splits while preserving the other.
- Require a full statement, exact snapshots, matching child category/amount allocations, bounded dates, no ledger ownership and a confirmed identity.
- Preserve backup, durable pending intent, synchronization and independent full-budget readback with fail-closed recovery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-split-deduplication`: Add a separate user-confirmed twin-split retirement operation.

## Impact

Actual adapter, focused tests, runbook and specification. Implementing this change alone never writes financial data.
