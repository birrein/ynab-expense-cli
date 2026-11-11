## Context

The current historical transfer date operation changes both reciprocal legs under an exact snapshot, durable pending audit and independent verification. It requires one-day corrections inside the same month.

## Goals / Non-Goals

**Goals:** Reconcile a documented operation date with a later bank posting at a month boundary while preserving the paired transfer.

**Non-Goals:** Infer missing transfers, change amounts or accounts, rewrite sources, or assume a posting date is an operation date.

## Decisions

Keep the original mode unchanged. A separate explicit `postingDateEvidence` supplies a distinct origin statement ID and a posting date equal to the old transfer date. Require a target date one to three calendar days earlier in the immediately preceding month, plus existing receipt and destination statement IDs. The operator independently checks both statements and the receipt, including dates, accounts and amounts. Preserve duplicate checks and the exact same transaction/audit pipeline. A generic unrestricted date correction would be less safe.

## Risks / Trade-offs

Statements can use posting and operation dates differently → document the distinction and require all three sources; the adapter does not authenticate their contents. Pending audit prevents retries after a partial write.
