## Why

Confirmed bank cashflows cannot be posted when their accurately identified merchant does not yet exist, even though preview currently suggests they can. This blocks statement reconciliation and can leave misleading plans.

## What Changes

- Preview explicit creation of a missing exact payee for an evidenced expense or income, and reject ambiguous equivalent names.
- On apply, back up and revalidate before creating the payee and movement; verify both independently and preserve recovery on retry.
- Keep transfer behavior and all source, duplicate, lease and financial invariants unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities

- `actual-confirmed-cashflows`: support safely creating a missing merchant as part of an otherwise valid cashflow.

## Impact

Cashflow adapter, policy tests, operational runbook and Actual payee catalog in the selected budget.
