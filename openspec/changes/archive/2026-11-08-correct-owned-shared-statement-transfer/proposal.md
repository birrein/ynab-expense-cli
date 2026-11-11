## Why

Some existing reciprocal transfers cite both bank statements as shared Gmail messages and both banks post them after the receipt date. Their original sources must be preserved while aligning their dates to the statements.

## What Changes

- Allow an explicit common-posting correction with two identified statement messages, distinct from transfer-specific receipt sources.
- Retain original ledger, sources and all audited, deduplication, backup and independent verification controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-owned-transfer-posting-date`: Permit a bounded common-posting correction where both original statement emails are shared with other movements.

## Impact

Actual adapter validation, tests and operator runbook; no transaction creation or source changes.
