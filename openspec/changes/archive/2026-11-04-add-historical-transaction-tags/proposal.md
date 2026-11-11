## Why

Historical imported expenses lack Gmail ledger entries, preventing user-authorized tags despite an identifiable existing transaction.

## What Changes

- Add a bounded operation to prepend one authorized tag to an identified historical expense without inventing sources.
- Preserve transaction fields, require preview, lock, backup, synchronization, independent verification and a durable private audit.

## Capabilities

### New Capabilities

- `actual-historical-transaction-tags`: Safely add tags to historical expenses outside the Gmail ledger.

### Modified Capabilities

## Impact

Actual daily adapter, transaction note tests, runbook, and OpenSpec; no new financial transactions.
