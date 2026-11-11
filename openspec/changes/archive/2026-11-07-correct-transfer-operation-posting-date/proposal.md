## Why

A card-payment receipt and destination card statement may establish an operation date before the checking account's next-business-day posting. Existing transfer date correction only allows one day within the same month, leaving linked legs inconsistent at period boundaries.

## What Changes

- Allow a strictly evidenced cross-month correction from posting date to the earlier operation date, using two distinct bank statements and the payment receipt.
- Preserve exact identity, duplicate checks, pending audit, backup and independent full-budget verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-transfer-date`: support a bounded evidence-backed posting-date difference across months.

## Impact

Transfer date correction policy, tests, specification and runbook. No new transactions or external services.
