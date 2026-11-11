## Why
Existing line-of-credit principal payments were imported as expenses. Bank statements confirm both accounts, so preserving the source transaction while linking a corresponding transfer is necessary for accurate balances and spending.

## What Changes
- Add a tightly scoped, statement-backed conversion of an existing unreconciled payment into a native own-account transfer.
- Preserve the original identity and provenance, reject ambiguity, and verify all changes with backup and audit.

## Capabilities
### New Capabilities
- `actual-evidenced-payment-transfer`: Safe conversion of a verified historical principal payment to a paired transfer.

### Modified Capabilities

## Impact
Actual daily adapter, tests, operational runbook and OpenSpec; no new dependencies or remote configuration.
