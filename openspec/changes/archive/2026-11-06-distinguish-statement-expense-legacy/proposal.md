## Why

Two different merchants on the same statement may charge the same amount on nearby dates. A historical match can lack attached sources even when the original receipt and both bank rows are independently available.

## What Changes

- Permit one strictly identified legacy expense match using its exact snapshot, original receipt and the two distinct rows of a shared verified statement.
- Keep extra matches, same-merchant ambiguity and unsupported sources in Review and preserve financial safeguards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-confirmed-cashflows`: add an audited different-merchant legacy-row evidence case.

## Impact

Cashflow validation and audit, focused tests and runbook. No new dependencies.
