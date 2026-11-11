## Context

Historical split corrections already use exact snapshots, backup, full revalidation, single Actual update and independent full-budget verification. A source-backed rounding difference can require changes to more than one child.

## Goals / Non-Goals

**Goals:** Make an explicit multi-child correction atomic within the existing API write and preserve prior candidate compatibility and audit recovery.

**Non-Goals:** Infer allocations or source identity; alter categories, dates, notes, splits owned by the ledger or reconciled data.

## Decisions

Allow either the existing `childId` and `newChildAmount` fields or a `childAmounts` list of `{childId,newAmount}` (minimum two), never both. Require exact unique IDs, changed negative integer amounts, at least two elements, and sum equality. Preserve original candidate in the existing audit. Generate the corrected full parent in memory, reuse backup, concurrency and independent budget/balance verification. Operator validates evidence and allocation before plan/apply. This avoids successive financial writes and preserves existing audit compatibility.

## Risks / Trade-offs

- Incorrect allocation from plausible source data → require explicit amounts and evidence; operator independently checks all source amounts and proportional rounding.
- Interruption after API write → unaudited changed state is rejected; inspect backup and live budget before retry.
- Concurrent edit → compare fresh full snapshot immediately before writing and independently after synchronization.
