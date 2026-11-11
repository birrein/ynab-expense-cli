## Why

A statement can contain repeated purchases from the same merchant for the same amount on different dates. The existing similarity guard stops these even when every nearby transaction is explicitly matched to a different row in the same statement.

## What Changes

- Add a narrowly scoped, audited statement-row exception for expenses with different dates and the same account and amount.
- Preserve source idempotency, complete duplicate review, backup, lease, sync and independent verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-confirmed-cashflows`: allow separately verified same-merchant statement rows while retaining the existing different-merchant receipt case.

## Impact

Cashflow classification, its tests, operator runbook and audit. No dependencies or other budgets are changed.
