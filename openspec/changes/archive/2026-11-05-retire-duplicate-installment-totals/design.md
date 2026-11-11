## Context

Historical Actual entries may contain a purchase total and separate installment entries, all affecting the same card account. Existing aggregate retirement requires same-date ledger-owned components and cannot safely represent a historical monthly series. The user explicitly requires installments without the extra total. See the proposal and capability spec.

## Goals / Non-Goals

**Goals:** Remove one precisely audited total only after its full already-posted series and statement evidence have been inspected. Keep the existing transaction identities, dates, amounts and categories for the installments.

**Non-Goals:** Generate installments, alter their dates or rounding, represent the refinancing, handle partially paid series, or infer a statement's meaning from amounts alone.

## Decisions

- Add a separate candidate operation and module using the established snapshot/backup/lock/independent readback pattern. Extending the existing same-date aggregate operation would weaken its semantics.
- Include exact original transaction snapshots and a numbered list of exact installment snapshots with independently verified statement IDs and statement dates. Require a one-to-one numbering, same account/payee/category, distinct statement periods, matching negative amount and exact sum. Human inspection remains necessary because a Drive ID alone does not establish the contents.
- Reject ledger-owned total or components, transfers, splits, reconciled or scheduled items, source mismatches and nonexact audits. Preserve all other records and verify the delta against a fresh download.
- Keep old exact data and evidence in private backup and audit. A missing original without a matching verified audit is an error, not permission to retry a new identity.

## Risks / Trade-offs

- [Matching merchant text can differ between bank and store] → Require independent original purchase evidence and explicit per-statement provenance; never equate purchases by amounts alone.
- [Historical booked dates can differ from bank billing dates] → Capture both exact dates and require the statement month for each numbered installment; do not change the installment date.
- [An error after deletion can leave incomplete audit] → Stop, preserve the backup and inspect the source before any retry; do not guess or recreate.

## Migration Plan

Introduce the operation without changing other paths, test positive and negative scenarios, validate OpenSpec, and then apply separately to each fully substantiated duplicate with a new candidate and owning lease. Rollback is restoration from the private pre-write backup after investigation.
