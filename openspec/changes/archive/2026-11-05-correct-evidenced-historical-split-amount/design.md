## Context

Historical Actual splits can contain multiple categories and may not belong to the daily ledger. Official API parent update accepts the parent amount and full child list as a single operation.

## Goals / Non-Goals

**Goals:** Make one precisely evidenced amount correction while preserving all identities and unrelated information.

**Non-Goals:** Inferring receipt allocation, changing categories, correcting reconciled, transfer, scheduled, or ledger-owned transactions, or automatically recovering unaudited writes.

## Decisions

Require the complete exact old parent and children, exact identified child, new amounts, evidence and source references. Confirm child sum equals old parent and new child sum equals new parent. The API parent update includes exact children with only target amount changed and includes the original payee to preserve inherited child payees. Revalidate the entire budget after backup and independently compare all fields and balance delta after sync. An unaudited changed state stops for manual inspection; exact audited retry is a no-op.

## Risks / Trade-offs

- Concurrent remote updates can occur after preflight; readback detects them and preserves backup for manual recovery.
- A crash after write and before audit is not blindly repeated; the operator must inspect live state and backup.
