## Why

A marketplace sale can first settle in a wallet and then move to a bank account. A historical bank credit imported as income conceals the wallet movements and may misclassify a transfer as income.

## What Changes

- Add an evidence-bound operation to record the wallet's net sale proceeds and convert the existing bank credit into a reciprocal own-account transfer without changing its ID.
- Protect source identities, reject duplicates and stale previews, and require backup, durable pending audit, synchronization, independent readback, and idempotent retry.
- Do not infer gross fees or profit from an unexplained difference between sale price and settlement.

## Capabilities

### New Capabilities

- `actual-marketplace-sale-transfer`: Safely reconstruct an evidenced marketplace settlement and its subsequent own-account transfer.

### Modified Capabilities

None.

## Impact

Actual daily adapter, unit and interruption tests, runbook, and CLP ledger state. No bank transfers or external payments are initiated.
