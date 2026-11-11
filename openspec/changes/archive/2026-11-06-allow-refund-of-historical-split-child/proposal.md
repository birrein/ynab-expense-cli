## Why

A settled refund of one item in an existing historical split cannot currently be linked to that item, leaving the real bank credit and account balance incomplete.

## What Changes

- Allow an evidence-backed refund to reference a specific child of an unchanged historical split, retaining the child's category and preserving the original split.
- Require an exact parent snapshot, bank and merchant evidence, unique source and cumulative child refund limits, alongside the existing plan, backup, lease and independent verification.
- Preserve all existing restrictions on ordinary and cross-account refunds.

## Capabilities

### New Capabilities

- `actual-historical-split-child-refund`: Settle a verified same-account refund linked to an item in a historical split.

### Modified Capabilities

None.

## Impact

Actual daily policy, tests and runbook; no changes to source purchases or bank accounts.
