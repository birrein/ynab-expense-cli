## Context
A historical income aggregate without source identity overlaps verified income entries in the same account, while containing other amounts that must be retained. The operator must verify external statements; IDs and arithmetic alone are not proof.

## Goals / Non-Goals
**Goals:** Atomically adjust only the aggregate by the exact sum of distinct already-verified component credits; preserve residual, sources and all other data; durable audit and safe recovery.
**Non-Goals:** Infer group composition, edit components, resolve unspecified income or alter other accounts.

## Decisions
Plan contains exact complete snapshot of the aggregate, full component snapshots and their matching ledger entries, statement references, a separately declared positive residual, and detailed evidence. Validate active account, simple historical positive aggregate, absence of ledger ownership/schedule/transfer/reconciliation, unique component IDs and distinct bank sources, verified income ledger bindings and same account, and exact positive residual. Reject stale snapshots and existing unrelated pending audits. Hash the candidate for plan/apply matching.

Acquire lease and writer lock, backup and record a durable pending intent before writing. Sync and compare full snapshot immediately before mutation; update only amount, sync, then download independently and compare all fields and unrelated data and expected account delta. Complete the audit only after verification. A pending intent never blindly repeats a write; complete exact retries perform read-only verification. Keep original provenance and values in audit/backup.

## Risks / Trade-offs
Component-to-group identity remains operator-evidenced; guards cannot authenticate documents. Actual lacks atomic compare-and-set; readback detects but cannot prevent a concurrent edit. Residual stays grouped pending subsequent evidence.
