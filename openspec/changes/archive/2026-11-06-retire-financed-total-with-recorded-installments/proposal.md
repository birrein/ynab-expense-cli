## Why

A financed purchase can be recorded both as its cash price and as all separately billed installments. Existing deduplication rejects the case when financing makes the installment sum exceed the cash price.

## What Changes

- Accept an explicitly stated, positive and arithmetically exact financing cost when the original purchase and complete installment series are individually evidenced.
- Preserve existing exact identity, accounting, backup, lease, verification and retry safeguards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-installment-total-deduplication`: Permit an evidenced financed series whose total includes an explicit finance cost.

## Impact

Actual installment deduplication adapter, tests and runbook; no migration of prior data.
