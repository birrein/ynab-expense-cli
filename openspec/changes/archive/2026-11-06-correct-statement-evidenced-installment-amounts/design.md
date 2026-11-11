## Context

The current historical amount operation requires a Gmail merchant receipt, even for an installment whose original and billed statements independently identify the same purchase.

## Goals / Non-Goals

**Goals:** Support independently reviewed, distinct bank statements and two exact consecutive neighbors for bounded CLP installment rounding corrections.

**Non-Goals:** Resolve ordinary expenses without a receipt, alter dates or categories, trust statement IDs as content proof, allow larger discrepancies or change reconciled transactions.

## Decisions

Add a mutually exclusive `statementSeries` object containing the original statement ID, installment number and total, and exact previous/next snapshots (or previous and previous2 for final installments). Validate identical normalized `#cuotas` signatures, account/payee/category, unique IDs, exact live snapshots and month sequence. Require different valid target and original statement IDs, CLP, and at most 1,000 minor units of correction. Existing receipt candidates remain unchanged.

## Risks / Trade-offs

- Unrelated bank files or mismatched series → operator must read both statements and validate purchase, account and installment independently; exact snapshots and bounded changes provide additional checks.
- Interrupted or concurrent updates → preserve backup and existing full-budget readback and fail-closed behavior.
