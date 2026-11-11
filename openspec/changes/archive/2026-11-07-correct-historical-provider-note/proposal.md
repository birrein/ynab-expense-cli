## Why

Historical entries may retain incorrect descriptive details after a bank amount correction, even when a provider receipt establishes the correct information.

## What Changes

- Allow a narrowly scoped literal correction to an unreconciled historical expense note with a distinct bank statement and provider receipt archived in Drive.
- Preserve provenance, tags, account balances and all other fields through backup and independent readback.

## Capabilities

### New Capabilities

- `actual-historical-provider-note`: evidence-backed historical note correction.

### Modified Capabilities

None.

## Impact

Actual daily adapter, tests and runbook. No new external services or transaction creation.
