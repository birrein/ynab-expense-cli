## Why
Bank statements confirm settled expenses for which the category is unknown. The statement cashflow operation currently prevents recording them even when the account, amount and date are certain.
## What Changes
- Permit an explicitly uncategorized statement-backed expense with a reason and Review status.
- Keep unique sources, duplicate protection, backups, lock and independent verification.
## Capabilities
### New Capabilities
### Modified Capabilities
- `actual-confirmed-cashflows`: accept a verified uncategorized bank expense without inventing a category.
## Impact
Actual adapter, tests, documentation and OpenSpec; no changes to the server or budget selection.
