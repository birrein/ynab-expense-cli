## Why

An independently documented purchase may share its amount with multiple already verified statement rows on the same prior date. The classifier currently blocks it even when each row is a separate merchant and an independent receipt identifies the new purchase.

## What Changes

- Allow verified distinct-merchant prior rows to share a date, while continuing to require different prior and new dates, exact snapshots, independent ledger sources, the shared statement and complete conflict coverage.
- Allow the already guarded creation of an exact new payee for this evidence mode.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `actual-confirmed-cashflows`: permit concurrent prior rows for distinct independently verified merchants.

## Impact

Cashflow classification, tests and the operational runbook. No external dependencies or other budgets change.
