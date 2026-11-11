## Why
A historical own-account incoming transfer is recorded as a standalone credit; adding a full pair would duplicate the destination balance.

## What Changes
- Convert an exact unsupported historical credit into a native linked transfer only with independently inspected sender evidence and a matching destination statement.
- Preserve the historical credit ID and amount, add only the missing origin leg, replace stale notes with cited provenance, and retain backup and pending/completed audit.

## Capabilities
### New Capabilities
### Modified Capabilities
- `actual-evidenced-payment-transfer`: add safeguarded conversion of a historical positive standalone credit.

## Impact
A separate adapter operation, tests and runbook. No server or budget configuration changes.
