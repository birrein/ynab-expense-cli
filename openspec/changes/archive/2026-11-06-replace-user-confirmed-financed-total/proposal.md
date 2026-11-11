## Why

A user can explicitly identify a historical card purchase as the one shown in a complete bank installment series even when a merchant receipt is unavailable. The current operation only accepts a Drive receipt for financed replacements.

## What Changes

- Permit an explicit user confirmation tied to the precise historical transaction and complete billed bank series.
- Preserve original ID, notes, category, duplicate checks, audit, backup and independent verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-card-total-replacement`: Add an independently validated user-confirmed financed evidence path.

## Impact

Actual CLI adapter, tests and runbook; existing receipt-backed candidates remain compatible.
