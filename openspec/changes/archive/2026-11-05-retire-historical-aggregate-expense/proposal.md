## Why

Historical expenses sometimes aggregate line items already registered independently from a complete bank statement.

## What Changes

- Retire a historical aggregate only when exact bank-backed components prove the same payment, preserving their ledger records.

## Capabilities

### New Capabilities

- `actual-historical-aggregate-expense`: Retire an unowned aggregate duplicated by statement-backed components.

### Modified Capabilities

## Impact

Actual aggregate retirement validation and audit; no direct database changes.
