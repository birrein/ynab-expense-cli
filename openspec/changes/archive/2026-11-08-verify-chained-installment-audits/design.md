## Context

The state ledger stores original snapshots, corrected values, backup paths and verification times for each completed amount and date correction. Neighbors in an earlier candidate are also exact snapshots. Separate later corrections can make a previously valid retry fail despite its backup and audit remaining intact.

## Goals / Non-Goals

**Goals:** Reconstruct only exact audited single-field transitions in chronological order for previously completed candidates. Preserve read-only retry semantics and fail closed for everything else.

**Non-Goals:** Do not alter transaction data, audits or backups; do not support note, category, series-wide, pending or unaudited changes; do not relax matching for first-time writes.

## Decisions

On a retry, require the supplied candidate to equal its completed audit and derive the immediately verified post-correction target snapshot. For the target and each saved neighbor, compare the live snapshot with that snapshot or a unique chain of later completed per-transaction date and amount audits. This applies to statement-series candidates and receipt-backed historical transactions whose original note contains `#cuotas`. Each link must have the exact preceding full transaction, the same currency and ID, a valid verification time strictly later than the preceding link, and a nonempty backup. Date audits additionally require status `complete`; amount audits require a verification timestamp. Each transition changes only its audited field and may be used once; ambiguous or missing links reject. Non-installment modes keep their existing behavior. New corrections and their initial readback keep exact matching.

This uses existing durable audit records as the adapter's authoritative record, as its existing retry paths already do. Simply ignoring changed dates or neighbors would accept unrelated edits; reading arbitrary backups as authority or rewriting the audit would make verification less reliable. Notes changes remain unsupported until separately designed.

## Risks / Trade-offs

- Later corrections can be genuine but lack a link or verification timestamp. Fail closed and inspect rather than infer.
- Financial writes can race external clients. Existing lease, lock, backup and full-budget independent readback remain unchanged.
- A completed audit with inconsistent metadata must not become a relaxation path; require exact candidate, full snapshots, timestamps, currency, status and unique link before any retry result.
