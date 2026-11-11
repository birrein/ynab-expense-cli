## Context

The existing adapter exposes separate, audited operations for historical category and split amount corrections. Simple historical expenses have no corresponding amount correction. The user authorized evidence-led reconciliation and continued autonomous work; the documented CLI remains the only financial writer.

## Goals / Non-Goals

**Goals:** Correct the evidenced amount of one simple expense, retaining its identity, date, category, notes, and cleared flag; support safe audited retries.

**Non-Goals:** Modify transfers, splits, reconciled entries, scheduled transactions, ledger-owned transactions, categories, source IDs, or other budgets. The operator verifies documents; the adapter validates identifiers and transaction state, not document contents.

## Decisions

Use a dedicated candidate with the complete previous transaction snapshot, statement Drive ID, Gmail receipt ID, new amount and evidence. Reject unknown fields and mismatches. A cleared but unreconciled expense may be corrected while retaining its cleared flag, because the bank and receipt can prove an error in the cleared amount. Compare the entire budget and the exact account balance delta in a fresh independent readback. A complete matching audit permits read-only retries; a changed target without matching audit fails closed. Backup precedes all mutation.

The alternatives are adding a duplicate expense or directly editing the local database. Both lose provenance or bypass the existing safety protocol. The split correction is also unsuitable because it requires a split and changes a child.

## Risks / Trade-offs

- A source ID does not prove its contents → require the operator to inspect the statement and receipt and state the identity match before preview.
- Concurrent remote writes are not atomically preventable → revalidate immediately before writing and compare the complete independent snapshot after synchronization.
- A process may fail after a remote write → a changed record without a matching completed audit is rejected for manual inspection, never silently replayed.
