## Why

The historical installment date operation requires a following installment, so it cannot correct an evidenced final installment. This leaves the statement-period balance wrong even where the complete series and final charge are known.

## What Changes

- Permit the final installment of a series of at least three to be validated using the preceding two exact consecutive installments and the statement and purchase evidence.
- Preserve all current ownership, duplicate, backup, audit and independent verification protections, and existing intermediate-installment behavior.
- Document and test the terminal case and reject malformed or ambiguous sequences.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-installment-date`: allow correction of a final installment using its two previous neighbors.

## Impact

The Actual daily adapter, its policy tests, the operational runbook and the existing capability spec. No budget, transaction or account is changed by implementation alone.
