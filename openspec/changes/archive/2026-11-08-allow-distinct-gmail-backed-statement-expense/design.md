## Context

The existing cashflow duplicate check needs evidence for every matching transaction. Gmail-imported expenses have `ledger.records`, not `ledger.cashflows`, and may lack a statement URL in their notes.

## Goals / Non-Goals

**Goals:** admit one independently evidenced different merchant and date while preserving the verified Gmail transaction and enforcing normal safeguards.

**Non-Goals:** add missing statement links to prior transactions, infer a category, or suppress extra duplicate matches.

## Decisions

- Use a separate `distinctGmailStatementExpense` exception with exact prior transaction and ledger snapshots, distinct merchant names, dates, statement references and email IDs. The operator inspects the actual statement and both receipts; descriptors do not establish identity.
- Require the prior Gmail imported ID, every source link, every identical source ledger entry, backup and verification, plus disjoint sources. The new transaction keeps its own stable statement source and evidence; reject any extra conflict or changed snapshot.
- Reuse existing cashflow lease, lock, backup, sync and full independent readback, saving the exception in the ledger. Preserve the source and retry semantics; no speculative new transaction after a partial error.

## Risks / Trade-offs

- [Similar merchants or forged descriptors] → operator reviews both bank statement rows and independent receipts, and validation rejects matching normalized merchants or references.
- [Previous source was reassigned] → require exact prior snapshot and matching verified ledger records for all prior messages; reject overlapping or reused sources.
