## Why
Historical expenses can have an incorrect category even when the bank evidence and user instruction identify the intended one. The current adapter only fills empty categories.

## What Changes
- Add a narrowly scoped, explicitly authorized amendment for a simple historical expense absent from the source ledger.
- Preview, back up, lock, synchronize, independently verify, and audit changing only its category.

## Capabilities
### New Capabilities
- `actual-historical-category-amendment`: Safely recategorize an identified historical expense.

### Modified Capabilities
None.

## Impact
Actual adapter, tests, runbook, and private reconciliation audit.
