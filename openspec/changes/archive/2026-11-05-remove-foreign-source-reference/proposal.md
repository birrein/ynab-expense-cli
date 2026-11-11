## Why

A link to another transaction's receipt embedded as descriptive context makes duplicate detection attribute that receipt to two transactions.

## What Changes

- Permit removing one verified foreign receipt reference while preserving both transactions and their own source links.
- Guard the repair with exact identities, ledger ownership, backup, independent verification and idempotent audit.

## Capabilities

### New Capabilities

- `actual-foreign-source-reference-repair`: Repair a misleading reference to another transaction's source.

### Modified Capabilities

None.

## Impact

Actual daily adapter, tests and operational runbook.
