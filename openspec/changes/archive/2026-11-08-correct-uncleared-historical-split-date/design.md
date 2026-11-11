## Context

The existing operation changes a split date, audits the exact preimage and compares a fresh full snapshot after sync. It currently requires a cleared parent and children.

## Goals / Non-Goals

**Goals:** Preserve an explicitly specified boolean cleared state shared by the parent and all children with all existing safeguards.

**Non-Goals:** Mark transactions cleared, reconcile accounts, support mixed statuses or change split categories or amounts.

## Decisions

Reuse the current date-only operation and `preserveCleared` field as an explicit exact boolean. Reject nonbooleans and mixed child statuses. This is narrower than a second mutation path or temporarily marking the split cleared, and retains the existing pending audit and retry semantics.

## Risks / Trade-offs

- [Asynchronous split updates] → Existing polling plus full independent snapshot comparison and pending audit remain mandatory.
- [Evidence or ownership ambiguity] → Existing exact snapshot, Gmail/statement evidence and duplicate/ledger checks remain unchanged.
