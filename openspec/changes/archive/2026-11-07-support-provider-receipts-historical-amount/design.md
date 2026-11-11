## Context

The existing correction has strict transaction and budget invariants but accepts only Gmail receipts, statements for installment rounding or subscription notices. The operator already validates evidence outside the adapter.

## Goals / Non-Goals

**Goals:** Support a distinct Drive provider receipt without reducing existing safeguards.

**Non-Goals:** Automatically authenticate, read or determine the meaning of third-party evidence; modify notes or change transaction identity.

## Decisions

Accept `providerReceiptId` as an exclusive evidence mode, with a valid Drive identifier distinct from `statementId`. The operator must read both documents and verify identity and amounts. Reject ambiguous combinations. Reuse the existing correction, audit and readback pipeline. An unrestricted URL or treating the receipt as a Gmail ID would weaken source identification.

## Risks / Trade-offs

An identifier does not establish the facts → explicitly require independent operator inspection and retain the original statement requirement.
