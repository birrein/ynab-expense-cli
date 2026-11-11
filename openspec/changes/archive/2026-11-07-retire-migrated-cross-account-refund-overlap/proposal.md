## Why

A documented purchase appears both as a historical gross card charge and a later net transaction in the principal account. The gross was expressly excluded from an audited account migration, so normal same-account deduplication cannot resolve it or preserve the migration's retry contract.

## What Changes

- Add a narrowly evidenced operation to retire one excluded gross expense while retaining its matching net historical transaction and full documented refund evidence.
- Preserve complete snapshots and source identifiers in an immutable retirement audit; allow the completed migration's read-only verification to recognize only this exact completed retirement.
- Require preview digest, lease, backup, pre-write pending intent, sync and full independent readback; fail closed after interruption.

## Capabilities

### New Capabilities
- `actual-cross-account-refund-overlap`: Resolve an evidenced gross and net representation across accounts linked by a verified partial migration.

### Modified Capabilities
- `actual-partial-historical-account-migration`: Verify an explicitly excluded row through its exact completed retirement audit.

## Impact

Actual adapter, migration verifier, test suites, runbook and private audit state; no changes to YNAB or unrelated budgets.
