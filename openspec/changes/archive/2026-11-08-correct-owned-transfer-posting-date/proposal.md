## Why

An already verified cashflow transfer can post on different dates in its two accounts. Existing historical transfer-date corrections deliberately reject owned sources, so this discrepancy cannot be corrected without preserving the original source and audit.

## What Changes

- Add a narrowly scoped, statement-evidenced correction of one leg of an existing owned transfer, with backup, durable audit and independent verification.
- Keep the original cashflow ledger and source identity intact and make exact original retries safe after the correction.
- Reject ambiguous, modified, reconciled, competing or interrupted cases and block mutations while an audit is pending.

## Capabilities

### New Capabilities

- `actual-owned-transfer-posting-date`: Preserve a verified cashflow transfer while correcting an independently evidenced posting date.

### Modified Capabilities

- `actual-confirmed-cashflows`: Verify exact original transfers whose date was subsequently corrected by a complete linked audit without rewriting their ledger.

## Impact

Actual daily adapter, cashflow classification and tests, OpenSpec and operating runbook; no direct database writes or new transactions.
