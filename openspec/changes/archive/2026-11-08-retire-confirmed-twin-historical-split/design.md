## Context

Existing split retirement requires verified individual ledger components; it cannot handle two preexisting split parents. Historical split notes and dates can differ while the statement shows one purchase. The user must explicitly confirm the two refer to one purchase before use.

## Goals / Non-Goals

**Goals:** Provide a narrow separate operation that retires one exact split and retains the other with every field and child unchanged.

**Non-Goals:** No inference of duplication from amount alone; no change to an existing ledger-owned transaction; no note or category repair; no account reconciliation claim or automatic recovery from partial writes.

## Decisions

Candidate supplies currency, complete old and retained split snapshots, statement Drive ID, explicit user-confirmation text, and operator evidence. Require same active account and equal negative amount, dates within one day, distinct exact IDs, at least two children with a unique category/amount bijection and equal totals, neither cleared/reconciled/scheduled/imported/transferred nor owned by any source ledger. Verify exact current snapshots and any ambiguity. The operator independently reads the bank statement and confirms the retained date, account and single charge; identifiers and user text do not prove content.

Commit requires lease, backup and full-snapshot revalidation, stores pending audit before official API deletion, syncs and compares the whole independent snapshot allowing only deletion of the old split and its balance delta, then marks the exact audit complete. Pending audits block retries for investigation; completed exact retries are read-only. Preserve original statement and snapshots in audit.

An unrestricted split-delete would destroy evidence; editing the candidate to satisfy the existing component-ledger operation would evade its safeguards. A purpose-specific operation keeps the distinction explicit.

## Risks / Trade-offs

- Similar splits can be separate purchases. Require user confirmation and bank evidence, and do not create a candidate claiming confirmation before it exists.
- Interruption after deletion must not cause re-deletion. Durable pending intent, backup and fail-closed retry require manual investigation.
