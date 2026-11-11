## Why

A historical installment can be marked cleared but not reconciled while its date differs by one day from the statement's billing cutoff. The existing date correction rejects it even when the purchase and installment series are identified.

## What Changes

- Allow an explicit one-day, same-month correction of an unreconciled cleared installment while preserving its cleared flag.
- Retain existing source, neighboring-series, duplicate, backup, lease and independent verification requirements.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-installment-date`: narrowly permit a documented cleared installment date correction.

## Impact

Historical date classifier, tests and operator runbook; no new dependencies.
