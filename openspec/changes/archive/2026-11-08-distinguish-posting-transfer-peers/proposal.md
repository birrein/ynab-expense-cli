## Why
Distinct same-value transfers from different accounts to the same destination can occur within the posting-date window. The current guard correctly blocks all nearby matches but cannot resolve a transfer even when both provider receipts and the bank statement prove two distinct payments.

## What Changes
- Permit explicit, fully snapshotted competing reciprocal transfers from distinct origin accounts, with distinct independently reviewed receipts and stated evidence.
- Keep strict collision protection for any unlisted, changed, ambiguous or unsupported peer; preserve every peer exactly after correction.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `actual-historical-transfer-date`: disambiguate a verified distinct transfer from an equal-amount posting-date peer.

## Impact
Actual transfer posting-date candidate validation, tests and runbook. No new transaction or account is created.
