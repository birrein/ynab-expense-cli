## Context

An installment may be evidenced by two statement periods even when no merchant email was issued. Existing operations already require exact target and neighboring transaction snapshots.

## Goals / Non-Goals

**Goals:** Allow a distinct original statement identifier instead of a Gmail purchase ID while retaining all existing invariants.

**Non-Goals:** Authenticate document contents automatically, change amounts, allow a single statement as both sources, or relax ledger, neighbor, backup or retry checks.

## Decisions

Require exactly one of `purchaseMessageId` and `purchaseStatementFileId`. For statement mode, both Drive IDs must be syntactically valid and distinct. The operator must read and cross-check the documents before plan; IDs alone are not evidence. Use the existing exact candidate audit and preserve prior email mode.

## Risks / Trade-offs

- Unrelated statements might be supplied → require operator identity, account, installment series and dates verification plus exact neighboring transaction snapshots.
- Partial writes or concurrent modifications → retain existing fail-closed audit and independent full readback.
