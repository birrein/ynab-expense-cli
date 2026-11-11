## Why

Distinct merchants can charge the same amount on the same day. The ordinary duplicate check blocks the second even when a verified statement explicitly shows separate rows and the prior transaction is independently recorded.

## What Changes

- Permit an opt-in exception for distinct same-day statement rows only when an operator verifies the statement and every nearby matching transaction has a verified ledger record and exact snapshot.
- Preserve existing duplicate, source, lease, backup and readback checks; missing or conflicting evidence remains Review.

## Capabilities

### New Capabilities
- `actual-same-day-statement-expenses`: distinguish separately verified same-day, same-amount merchant charges.

### Modified Capabilities
- `actual-confirmed-cashflows`: allow the narrowly evidenced same-day exception alongside existing distinct-row checks.

## Impact

Cashflow classifier, its tests, runbook and specification. No changes to financial state or third-party APIs are required to implement this feature.
