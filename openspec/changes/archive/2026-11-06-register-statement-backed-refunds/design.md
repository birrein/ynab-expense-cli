## Context

The Actual adapter already registers statement-backed expenses and separately validates certain Gmail-backed refunds. The new path handles a simple expense owned by the statement cashflow ledger.

## Goals / Non-Goals

**Goals:** Preserve the original charge and its provenance while recording a verified credit on its actual settlement date; make interrupted operations fail closed and completed operations idempotent.

**Non-Goals:** Cross-account refunds, split transactions, changing the original purchase, and inferring a refund solely from a matching amount.

## Decisions

- A dedicated candidate includes the exact original transaction and cashflow ledger record, statement file ID, evidence and stable bank refund source. This prevents weakening existing Gmail-source rules.
- Validate account, category, original identity, date, refund amount and cumulative refunds, and reject nearby matching credits and conflicting sources. No fallback creates a second credit.
- Under the existing run lease, snapshot and back up the entire budget, revalidate before the write, and persist an intent in the authoritative ledger. An intent without verified completion is a stop requiring investigation. After sync, reopen the budget independently and compare the new credit, original expense, other transactions and account balances before completing the audit.
- Exact verified retries are read-only. The original transaction is never mutated.

## Risks / Trade-offs

- [Ambiguous evidence or interrupted write] → Stop without another write; inspect the statement source and backup.
- [Matching credit might be distinct] → Treat it as a duplicate candidate and require investigation rather than inferring identity.
- [Client-supplied evidence is not proof by itself] → The operator must inspect the actual statement and related merchant evidence before preparing the candidate.
