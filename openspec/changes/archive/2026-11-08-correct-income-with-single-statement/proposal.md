## Why
A complete bank statement sometimes covers both the operation date and the later posting date. Requiring two different statements prevents correcting a verified income even when a separate bank receipt identifies the payer, recipient, amount and original date.

## What Changes
- Add an explicit single-statement mode that requires a distinct independently reviewed bank receipt and statement coverage of both dates.
- Preserve all exact snapshot, payer, duplicate, hash, backup, lease and independent readback safeguards.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `actual-historical-income-statement-date`: allow a single statement covering both dates with an independent receipt.

## Impact
Actual historical-income date adapter, tests and runbook. No new transaction or category change.
