## Why

Some historical card purchases are recorded twice: once for the full purchase and again as a complete set of billed installments. This overstates spending and distorts the balance needed to reconstruct the Falabella restructuring.

## What Changes

- Add a narrowly scoped, audited operation to retire one exact historical purchase total only when a complete, independently evidenced installment series already exists.
- Preserve the original installment transactions, their categories and all other budget data, and require preview, lease, backup, synchronization and independent verification.
- Reject ambiguous or partial series, inconsistent statement evidence, existing ledger ownership, missing identities and unsafe retries.

## Capabilities

### New Capabilities

- `actual-historical-installment-total-deduplication`: safely remove an evidenced duplicate historical purchase total while preserving its complete historical installment series.

### Modified Capabilities

None.

## Impact

The Actual daily adapter gains one explicit candidate operation, an isolated policy module, regression tests and runbook documentation. It uses the official Actual API and existing private backup, lock and independent readback infrastructure; it does not alter other budgets or the underlying statements.
