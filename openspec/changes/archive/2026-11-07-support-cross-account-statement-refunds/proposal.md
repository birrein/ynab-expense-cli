## Why

A verified merchant refund can settle in a different owned account from the original card purchase. Existing cross-account refunds require two email sources, while statement-backed refunds require the same account and a cashflow-owned purchase. This prevents recording an independently evidenced settlement in an account statement without inventing a bank email.

## What Changes

- Add a narrowly scoped cross-account statement refund operation for a verified, categorized, ledger-owned simple purchase, an independently reviewed merchant refund, and an identified statement credit.
- Preserve the original purchase and category; reject ambiguous matches, partial audits, over-refunds, stale sources, and unsupported accounts.
- Require a preview, lease, backup, durable intent, synchronization, and independent full-budget readback.

## Capabilities

### New Capabilities

- `actual-cross-account-statement-refunds`: Audited cross-account merchant refund backed by an account statement.

### Modified Capabilities

None.

## Impact

Actual daily adapter, targeted tests, operations runbook, and OpenSpec requirements. No changes to the existing refund modes or other budgets.
