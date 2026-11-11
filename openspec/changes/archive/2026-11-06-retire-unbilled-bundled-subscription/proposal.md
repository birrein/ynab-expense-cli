## Why

Legacy budgets can contain an expected standalone subscription in addition to a billed bundle that already includes the same service. An unbilled expectation distorts the card balance but cannot be retired by a duplicate operation that requires equal amounts or source-owned retained transactions.

## What Changes

- Permit narrowly evidenced retirement of one historical unbilled standalone subscription while preserving a different-priced billed bundle.
- Require exact transaction snapshots, bank statement, bundle receipt, provider purchase history and corroborated service inclusion.
- Preserve full backup, revalidation, pending audit, independent readback and fail-closed retry semantics, including a historical cleared flag.

## Capabilities

### New Capabilities

- `actual-unbilled-bundled-subscription`: Safely retire a verified unbilled legacy standalone subscription associated with a retained bundled charge.

### Modified Capabilities

None.

## Impact

Actual's local adapter, tests and reconciliation runbook; no change to external account settings or other budgets.
