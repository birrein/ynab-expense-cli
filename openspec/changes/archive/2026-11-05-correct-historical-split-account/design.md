## Context
Statements show a split charged to a different card from the account in Actual. Existing operation handles only ordinary transaction notes and split deduplication.

## Goals / Non-Goals
**Goals:** An exact, auditable one-transaction account correction preserving all split fields. Independent snapshot must prove only the expected accounts and balances changed.
**Non-Goals:** Reconciliation adjustments, transfers, ledger-managed imports, inferred purchases, bulk correction or SQL writes.

## Decisions
Require complete before identity, explicit receipt and both statement links, active on-budget accounts, negative balanced split, no ledger ownership, duplicate guard and existing run/lock. Use official API on parent and pass the current payee explicitly because the upstream split update propagates parent properties to children. Verify all child fields after reconnect. A real isolated local API test is required before any financial application.

## Risks / Trade-offs
Unexpected API split normalization could alter payees or children → exercise real API in isolated local data and compare every field; stop and retain backup if production readback differs. Fail closed on uncertain post-write state.
