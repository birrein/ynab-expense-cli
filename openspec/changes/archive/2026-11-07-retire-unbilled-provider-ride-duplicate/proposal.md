## Why

An unverified historical ride duplicates the price, payee, category and route description of a previously recorded bank-confirmed ride. A provider data export covers the relevant interval and the later entry is not supported by two complete statements; existing retirement modes do not support two independently imported historical entries without ledger ownership.

## What Changes

- Add an evidence-gated retirement operation for one unbilled historical ride while preserving the earlier confirmed transaction and original snapshots.
- Require the exact provider-export hash, original receipt, two separate statements, lease, complete preview digest, pre-write intent, backup and independent full-budget readback.
- Keep source records and unresolved or dissimilar entries untouched; block financial writes if the intent is interrupted.

## Capabilities

### New Capabilities
- `actual-unbilled-provider-ride-duplicate`: Remove a historical ride entry unsupported by the provider export and statements when a prior actual ride has independently corroborated matching details.

### Modified Capabilities

## Impact

Actual adapter, private audit and tests; no changes to other budgets, provider records or Gmail labels.
