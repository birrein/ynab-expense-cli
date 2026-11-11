## Why
Confirmed historical expenses can be recorded on the operation date while the bank statement posts them later, affecting daily reconciliation. Existing safe posting-date operations only support transfers and positive income.

## What Changes
- Support an explicit statement-and-receipt-backed date correction of one existing simple historical expense.
- Preserve category, note, identity, amount, audit safeguards and all other data.

## Capabilities
### New Capabilities
- `actual-historical-expense-statement-date`: correct a bank-verified historical expense posting date safely.
### Modified Capabilities
None.

## Impact
Actual daily adapter, global pending guard, Node tests and operational runbook; no transaction additions or configuration changes.
