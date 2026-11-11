## Why

Historical expenses may be evidenced by a provider receipt archived in Drive rather than an email. The current amount correction rejects that evidence despite a matching bank statement.

## What Changes

- Accept a distinct Drive provider receipt as an alternative to the existing evidence modes for historical simple amount corrections.
- Retain exact snapshot, lease, backup, audit, revalidation and independent readback safeguards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-expense-amount`: permit verified provider receipts archived in Drive.

## Impact

Historical amount policy, tests, operational runbook and specification. No additional financial writes or external integrations.
