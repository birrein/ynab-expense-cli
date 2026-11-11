## Why

The completed partial-wallet audit currently checks the wallet's present balance against its initial reconstructed delta. Later legitimate wallet transactions therefore make its read-only retry fail even when every audited entry remains intact.

## What Changes

- Preserve the full-budget and exact balance checks at the original write's independent verification.
- Permit completed-audit retries to validate the original exact entries and linked mixed card source without requiring the wallet's current total to remain frozen.
- Continue rejecting changed, missing or duplicated audited transactions and references.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-partial-uber-cash-reconstruction`: Completed verification remains valid after unrelated wallet movements.

## Impact

Actual adapter retry verifier and tests only; no historical balances or transactions are changed by this fix.
