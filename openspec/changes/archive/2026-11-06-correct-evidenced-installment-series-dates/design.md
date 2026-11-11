## Context

A legacy series can have consecutive installments on dates that overlap their target billing months. A cleared but unreconciled record must retain its state.

## Goals / Non-Goals

**Goals:** Correct every statement-backed date in one audited operation without changing the series total or other fields.

**Non-Goals:** Reconciled records, changed amounts, transfers, source-ledger records, or inferred dates.

## Decisions

Require exact snapshots and explicit statement IDs for a complete numbered series, common description, receipt and matching identity. Compare full live state before any write; record a pending audit after backup, then update only dates. Verify all transactions and unrelated budget data from an independent download before completing the audit. Existing partial audits require manual investigation; no automatic recovery writes.

## Risks / Trade-offs

A process failure between date updates can leave a partial series; pending audit and backup force inspection before any retry. Cleared flags are retained and reconciled records are prohibited.
