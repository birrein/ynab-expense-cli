## Why

Historical transactions can contain transcription errors even when a bank statement and merchant receipt independently establish the charged amount. Creating a second expense would duplicate the purchase, while the existing split correction does not support simple expenses.

## What Changes

- Add a narrowly scoped, evidence-backed correction for the amount of an existing simple historical expense.
- Preserve transaction identity, category, cleared status, sources, unrelated records and account state except for the exact amount delta.
- Require preview, a lease and lock, backup, revalidation, independent readback, and an idempotent audit.

## Capabilities

### New Capabilities

- `actual-historical-expense-amount`: Correct one historical simple expense using a bank statement and an independent receipt.

### Modified Capabilities

None.

## Impact

Actual daily adapter dispatch, a focused correction module and tests, and the operations runbook. No changes to budgets, scheduling, or the user's other applications.
