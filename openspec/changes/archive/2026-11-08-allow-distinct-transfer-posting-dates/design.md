## Context

The current operation updates both transfer legs to one date. The bank can post the credit before the debit, and the official API has been tested in a disposable budget with separate leg dates and reciprocal transfer IDs intact.

## Goals / Non-Goals

**Goals:** Preserve the exact dates established by both statements and the original linked transfer, with a complete audited, recoverable verification.

**Non-Goals:** Infer timing, add a clearing account or new transfers, alter amounts, or edit already reconciled transactions.

## Decisions

- Add a distinct mode with exact full snapshots, the receipt and two distinct statement IDs. Require one existing date to remain unchanged and exactly one leg to change by at most four days. This avoids a broad historical migration.
- Reuse official API updateTransaction on only the selected leg. A synthetic isolated test supports this; a full independent readback after sync is mandatory.
- Bind plan to candidate, full snapshot and durable state hash; require exact expected hash, lease and lock. Back up and persist pending intent before the update. Block other mutations while pending; never auto-recover an interrupted update.
- Compare every transaction and all remaining snapshot fields, final balances, transfer linkage and independently derived daily cumulative balances around both dates. Repeated exact complete audit is read-only.

## Risks / Trade-offs

- [Matching by IDs does not establish source identity] → Operator must inspect both statements and receipt; reject nearby equal-amount competitors.
- [Provider may later normalize linked dates] → Verify fresh downloaded state and test persistence; do not claim long-term stability beyond observed readback.
- [Partial mutation] → Backups and pending intent precede the sole write; no retries while pending.
