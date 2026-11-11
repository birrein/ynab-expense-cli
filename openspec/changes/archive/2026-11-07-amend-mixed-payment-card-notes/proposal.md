## Why

Four card transaction notes still state that their Uber Cash portions are pending, although the shared-source components are now posted. Existing note correction would invalidate the original exact audit and is blocked by its source guard.

## What Changes

- Permit an explicitly evidenced, bounded literal note correction on a card transaction in a completed mixed-payment audit.
- Preserve the original audit and ledger, add an independently verified amendment audit, and allow exact original-group readback through that audited mapping.
- Retain backup, lease, lock, digest, source protection, pending-intent blocking and fail-closed recovery.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-partial-uber-cash-reconstruction`: Support audited card-note correction while retaining verification of the original shared-source group.

## Impact

Actual adapter, tests, runbook and only explicitly chosen card notes. No amounts, categories, sources or other financial records change.
