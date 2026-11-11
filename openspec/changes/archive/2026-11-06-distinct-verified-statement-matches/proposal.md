## Why

A settled statement purchase can be blocked by multiple equal-amount purchases from different dates and merchants, although the exact earlier purchases are already independently verified against the same statement.

## What Changes

- Add an audited exception covering every matching previously verified statement-backed expense, with exact identities and distinct dated statement rows.
- Keep provenance, lease, backup, full revalidation and independent readback; allow a confirmed new purchase to remain uncategorized and in Review.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-confirmed-cashflows`: distinguish a new statement row from all exact previously verified statement-backed matches.

## Impact

Cashflow classification, audit, tests and operating runbook. No historical movement is changed or created during preview.
