## Why
Two separate purchases have the same amount within the duplicate window, and their shared statement and individual receipts identify different merchants. The adapter needs an evidence-bound exception without weakening general duplicate protection.
## What Changes
- Allow a statement-backed expense when an exact existing conflicting purchase is independently proven distinct.
- Revalidate and audit the exception while preserving both sources and all unrelated records.
## Capabilities
### New Capabilities
### Modified Capabilities
- `actual-confirmed-cashflows`: distinguish same-amount purchases using statement and separate receipts.
## Impact
Cashflow classifier, tests, runbook and OpenSpec, without server changes.
