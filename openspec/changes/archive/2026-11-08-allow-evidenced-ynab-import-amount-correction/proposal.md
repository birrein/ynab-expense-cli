## Why

An imported historical card transaction can preserve the amount initially authorized even when the final statement settles a different amount. The existing amount correction rejects all imported identifiers, leaving evidence-backed discrepancies unresolved.

## What Changes

- Allow a narrowly evidenced amount-only correction for an unreconciled, simple transaction with a unique `YNABEXP:` import identifier.
- Require an original bank notice, merchant order and final receipt, plus the bank statement and bounded reconciliation of the original and settled amounts.
- Preserve the import identifier, other transaction fields, ledger protections, backup, synchronization and independent readback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-expense-amount`: Add an explicit evidence mode for bounded corrections to a unique YNABEXP historical import.

## Impact

The Actual adapter's historical amount correction, focused tests, operational runbook and this capability's specification. No new financial data are written by implementation itself.
