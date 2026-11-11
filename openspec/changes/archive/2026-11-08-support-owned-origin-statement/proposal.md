## Why

Some verified cashflow transfers already cite their origin statement rather than their destination statement. Both independently inspected statements remain available, but the current owned-transfer correction unnecessarily rejects these transfers.

## What Changes

- Accept an original cashflow record citing either the origin or destination statement while continuing to require both distinct independently verified statements and the original receipt.
- Preserve all other correction, source, backup, audit, retry and verification controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-owned-transfer-posting-date`: Accept an original statement from either end of the transfer.

## Impact

Actual adapter validation, tests and operator documentation; no change to transfer amounts or sources.
