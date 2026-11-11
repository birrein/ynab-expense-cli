## Context

Historical uncoupled income may predate its bank posting by a few days. Existing correction modes address card installments, splits and transfers, not a simple income.

## Goals / Non-Goals

**Goals:** Preserve one identified historical income while moving its date to the bank posting date, with complete audit and verification.

**Non-Goals:** Create income, change amount, payer, category or notes, infer counterparty identity, or touch reconciled or ledger-owned records.

## Decisions

- Require exact snapshot, distinct statements spanning old and new dates, evidence of payer and uniqueness and a posting one to four days after the old date. The operator inspects both documents and the target account, rather than relying on IDs or matching amount alone.
- Use hash-bound preview including snapshot, dashboard and stable ledger. A pending audit, lock and backup precede the update; independent readback checks all data, final balances and the exact daily effect.
- Block all financial mutations while pending and require an exact completed retry to be read-only.

## Risks / Trade-offs

- [Similar transactions or source ownership] → Reject nearby equal-amount income, linked sources and reconciled records; investigate manually.
- [Interrupted update] → Preserve pending intent and backup; do not retry automatically.
