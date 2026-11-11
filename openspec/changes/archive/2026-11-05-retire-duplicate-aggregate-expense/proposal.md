## Why
A newly recorded bank expense duplicates a historically itemized payment. Keeping both inflates expenses and reduces the account balance twice.
## What Changes
- Retire the exact ledger-owned aggregate only when a complete statement and exact same-date historical components establish it as their sum.
- Preserve component details, source provenance and a superseded ledger audit.
## Capabilities
### New Capabilities
- `actual-aggregate-expense-deduplication`: safely remove a confirmed aggregate duplicate while preserving its itemized historical components.
### Modified Capabilities
## Impact
Actual adapter, tests, runbook and specs; no server settings change.
