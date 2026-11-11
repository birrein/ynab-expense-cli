## Context

Source-owned transactions carry ledger provenance and immutable identity. Existing split amount correction deliberately rejects them and the ordinary refund flow only handles simple expenses.

## Goals / Non-Goals

**Goals:** Reconstruct one evidenced split and one subsequent same-account refund, preserving category net totals and unrelated budget state.

**Non-Goals:** Guessing the refunded category, reconciling bank balances generally, cross-account refunds, or recovery from a partial write without investigation.

## Decisions

- Preview requires a full exact prior parent, the exact source ledger record, the child ID, a unique refund import ID, and distinct bank and merchant evidence. Validate timestamps, positive amount, active category and original un-reconciled state.
- Increase that child and the parent by the refund, create a positive linked refund in the same category and account on its actual date, then independently compare all budget data against the expected snapshot. Update every source record and audit only after verification.
- Store original candidate and backup before writing. If interrupted between the two API writes or before audit, a retry detects state mismatch and stops; it must never repeat the refund.

## Risks / Trade-offs

- Two API writes are not atomic → backup first, prohibit silent retries, verify all fields and provide enough evidence for manual recovery.
- Generated refund IDs are not known ahead of time → use a stable import identifier and require exactly one matching record on readback.
