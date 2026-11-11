## Why
An older manually entered subscription can duplicate a verified card charge even when its manually recorded value is incorrect. Retiring the exact duplicate requires stronger proof than date and merchant alone.

## What Changes
Add an evidence-gated mode for a single historical subscription duplicate with an erroneous amount, retaining the verified bank-backed charge.

## Capabilities
### New Capabilities
- `actual-subscription-duplicate`: Retire a proven historical subscription duplicate when its amount was misrecorded.
### Modified Capabilities

## Impact
Actual duplicate retirement adapter, focused tests, and runbook. Affected user data is touched only through plan, owned lease, lock, backup, sync, and full independent readback.
