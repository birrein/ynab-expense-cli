## Why

Resolved expenses can retain obsolete pending text when a source is recorded in the ledger but absent from notes or when the transaction is a split parent.

## What Changes

- Add a bounded resolved-transaction note correction with exact identity, ledger and split checks.
- Preserve original provenance and tags without adding or fabricating sources; retain backup and independent readback.

## Capabilities

### New Capabilities

- `actual-resolved-note-correction`: Correct prose on resolved simple and split expenses with independently validated ledger provenance.

### Modified Capabilities

## Impact

Actual daily adapter, focused tests and operational runbook; no financial modifications.
