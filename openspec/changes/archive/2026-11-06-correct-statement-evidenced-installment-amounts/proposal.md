## Why

Historical installment amounts can differ by a few pesos from the bank's documented rounding, while the merchant receipt is unavailable. The existing amount operation requires that receipt and cannot use the original and current bank statements plus the neighboring installments as evidence.

## What Changes

- Allow a strictly limited statement-evidenced rounding correction for a historical installment when exact neighboring installments establish its identity.
- Require distinct original and target statement identifiers, consecutive series and a correction of at most CLP 10.
- Preserve existing merchant-receipt mode, backups, ledger protections and independent full readback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-expense-amount`: add a tightly constrained alternative evidence mode for historical installment rounding.

## Impact

Actual daily amount adapter, targeted tests and runbook. Operators must independently inspect both statements; identifiers alone do not prove their content.
