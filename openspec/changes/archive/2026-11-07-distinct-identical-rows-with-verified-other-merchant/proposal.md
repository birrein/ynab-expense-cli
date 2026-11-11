## Why

A statement may contain two identical purchases as well as a separately verified same-day purchase at another merchant for the same amount. The existing duplicate guard stops the second identical purchase even when all three statement rows and their sources are established.

## What Changes

- Permit a second identical statement row only when an additional single same-day distinct-merchant match is fully identified, independently verified against the same statement, and included in the candidate.
- Preserve full statement arithmetic, exact snapshots, source ordinals, complete duplicate enumeration, lease, backup, audit, and independent verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-same-day-statement-expenses`: allow a precisely evidenced second merchant match when validating a second identical row.

## Impact

Cashflow classification and tests, operational documentation, and the existing statement-expense specification. No change to bank accounts, currencies, credentials, or normal duplicate handling.
