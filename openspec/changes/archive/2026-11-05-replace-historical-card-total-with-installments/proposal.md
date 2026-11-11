## Why

Some historical card purchases were booked in full at purchase time although their statements charged installments over later months. This distorts historical balances and obscures billed obligations; adding installments beside the total would double count the purchase.

## What Changes

- Add a narrowly scoped, evidence-backed operation that replaces one exact historical purchase total with its complete statement-confirmed installments.
- Preserve the original transaction identity for the first installment, source provenance, payee, account and category, and prevent duplicates and unsafe retries.
- Require preview, an owned lease, exclusive lock, backup, durable pending audit, synchronization and independent full-budget verification.

## Capabilities

### New Capabilities

- `actual-historical-card-total-replacement`: Convert a complete, evidenced, simple historical card purchase into its billed installment series without double counting.

### Modified Capabilities

None.

## Impact

Actual adapter, its test suite and runbook; no YNAB writes, server configuration changes or unrelated budget mutations.
