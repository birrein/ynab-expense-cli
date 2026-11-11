## Context

The split correction has a narrow account-only update but cannot handle simple transactions. Existing snapshots and ledger audits provide evidence and concurrency safeguards.

## Goals / Non-Goals

**Goals:** Correct the account of an exact, simple historical expense after manual review of both full statements and the original notice, with independent verification.

**Non-Goals:** Guess identity from amount alone, combine duplicate transactions, alter dates, notes, categories, sources, reconciled transactions, or different budgets.

## Decisions

Use a separate candidate flag and handler, with full old transaction and two distinct statement IDs and notice URL. Reject destination candidates of the same amount within seven days. Reject ledger ownership and non-active accounts. Compare entire snapshots before write, persist a pending audit with private backup before invoking the official API, and fail closed on pending or inconsistent retries. Verify the expected account-only mutation and both balance changes on an independently reconnected snapshot. A completed exact audit is read-only on retry. Statements are reviewed by the operator; IDs alone do not establish evidence.

## Risks / Trade-offs

- Incorrect matching despite same amounts → require account identity, date, notice, full statements and manual contextual review.
- API partial failure → pending audit, backup and no automated second write.
- Concurrent budget changes → snapshot comparison before write and strict full-budget readback fail closed.
