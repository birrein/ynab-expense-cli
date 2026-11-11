## Why

Actual category resolution intentionally preserves transaction notes. Confirmed purchases therefore retain obsolete pending-category instructions, with no supported safe way to amend them.

## What Changes

- Add a dedicated transaction-notes amendment to the existing plan/apply adapter.
- Require exact transaction identity, category, provenance, previous notes and a bounded text replacement.
- Preserve metadata, unrelated content, financial state and the authoritative daily ledger; use the existing lease/lock, backup, sync and independent download.
- Document recovery and test failure paths before applying the specifically authorized corrections.

## Capabilities

### New Capabilities

- `actual-transaction-notes`: Safely amend descriptive text of an existing categorized Actual transaction.

### Modified Capabilities

None. Existing transaction specs cover the legacy YNAB CLI, which remains unchanged.

## Impact

Actual adapter scripts, isolated tests and Gmail runbook. No dependency, server, remote configuration or archived-budget changes. Financial candidates and audit artifacts remain private outside Git.
