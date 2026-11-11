## Context

The wallet statement proves a settlement followed by an own transfer. Actual has only the destination credit, historically categorized and annotated; existing conversion intentionally rejects such credits. The settlement amount is net and unexplained price differences are not fees.

## Goals / Non-Goals

**Goals:** Maintain the destination credit ID and all unrelated financial data; establish one net income and one native reciprocal transfer with traceable sources and an auditable fail-closed workflow.

**Non-Goals:** Moving money, changing unrelated entries, estimating sales profit or fees, or fixing historical wallet balances by arbitrary adjustments.

## Decisions

A dedicated candidate contains exact existing transaction snapshot, accounts, dates, amount, existing income category, two statement IDs, two message IDs and marketplace transaction reference. Human review establishes the contents of linked evidence; identifiers do not prove document content. The plan hash binds the entire candidate, classification and snapshot. Under the existing writer lock and run lease, backup and resnapshot precede a durable pending intent. Create the settlement income with stable imported ID, then use the official API to convert the historic destination credit to a transfer and obtain its reciprocal leg. Sync and reconnect independently, compare every existing transaction and all nonfinancial metadata, exact new legs, payees and per-account balances, then finalize the audit. Preserve the original note and add evidence links. A previously pending intent cannot be retried automatically.

## Risks / Trade-offs

- Two API writes cannot be atomic: a durable pending intent, backup, fail-closed retry and recovery instructions make partial writes visible.
- Similar historical transactions may be unrelated: conservative date/amount/source checks require review rather than force-adding.
- Gross sale and net wallet proceeds differ: recognize only proven net cash received; do not guess other fees or profit.
