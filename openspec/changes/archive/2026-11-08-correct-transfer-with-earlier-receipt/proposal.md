## Why

A historical transfer can have a manually entered date one day after the actual operation, while both accounts post it later. The current correction requires the receipt and old date to agree exactly.

## What Changes

- Permit an explicitly selected one-day earlier receipt for an otherwise verified reciprocal transfer, bounded by four days to the common posting date.
- Preserve identity, unique-candidate, plan, audit and independent readback protections.

## Capabilities

### Modified Capabilities

- `actual-historical-transfer-date`: support one bounded receipt-before-historical-date evidence alternative.

## Impact

Posting-date validator, tests and runbook. No transfer is created and no amount changes.
