## Why

A historical imported purchase may contain a description and source provenance but omit the receipt number even when the original bank notice, merchant order, receipt and settlement establish the same charge. Requiring that number in the old note leaves a documented authorization-versus-settlement difference unresolved.

## What Changes

- Add an explicitly constrained alternative identity check for historical imports whose original note identifies the merchant and source provenance but lacks the receipt number.
- Require independent source inspection, exact original snapshots, unique account/date/amount identity and protection against an already-recorded settled charge.
- Preserve all existing amount, source, ledger, backup, synchronization, readback and import-identity protections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-expense-amount`: Support a narrowly bounded original-note and unique-transaction identity alternative to receipt-number-in-note evidence.

## Impact

Historical amount correction validation, focused tests, runbook and capability specification. No financial write is implied by implementing the change.
