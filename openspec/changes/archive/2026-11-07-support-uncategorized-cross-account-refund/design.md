## Context

The refund matches a specific purchase by independent merchant and wallet evidence, but its category is genuinely unresolved. A category choice must apply to both sides rather than distorting category totals.

## Goals / Non-Goals

**Goals:** Account for the confirmed wallet credit promptly; preserve Review; later resolve both transactions together safely.

**Non-Goals:** Guessing category, creating a new bank transfer, changing the amount, or silently modifying old audit evidence.

## Decisions

Extend the existing operation with an explicit pending reason only when both purchase transaction and ledger record have null category and pending status. Preserve the original; record the refund with null category, the reason, source and pending status. Maintain the existing snapshot-bound plan, lease, lock, backup, intent and independent verification. A dedicated paired resolution requires exact snapshots, exact ledger and refund audit, and a resolved active expense category. Before either update, persist pending resolution audit. Verify all unrelated records and both account balances on independent readback, then update both records and complete the audit atomically. Prevent other operations from editing either linked entry while pending; partial writes fail closed.

## Risks / Trade-offs

- A category chosen later cannot safely be applied to one side alone: require paired resolution and block one-sided flows.
- Two category writes are not atomic: use a durable pending intent, backup and no automatic retry.
- Exact original audit becomes historical after resolution: preserve it and verify a separate immutable resolution audit for retry.
