## Context

The official Actual API operates on one budget at a time and cannot move an existing transaction ID between budgets. Ledger aliases can carry historical note amendments and must not be discarded or falsely attributed to a new ID. Normal source classification currently checks one budget at a time.

## Goals / Non-Goals

**Goals:** Migrate one verified original CLP card expense to its exact USD statement amount, preserve provenance and prior audit, and prevent cross-budget source replay.

**Non-Goals:** Automatically discover FX conversions, calculate exchange rates, change debt transfers, migrate splits, or resolve already reconciled transactions.

## Decisions

Use a new explicit candidate containing the complete old transaction, exact old ledger records and source IDs, statement file ID, USD account, payee and category IDs, exact USD cents and written evidence. Restrict to ledger-owned simple Gmail expenses, matching source links and source aliases, no transfer/schedule/refund/reconciled status, active destinations, distinct transactions or prior conflicting references. Require an operator-reviewed hash binding both full snapshots, dashboards, stable state, and candidate.

The USD replacement uses the exact original imported ID and source notes, plus a statement link; its new ID is recorded together with the complete prior ledger and transaction in an immutable audit. All aliases are updated together only after full independent verification; historical notes amendments stay with the prior ledger snapshot in the migration audit and remain intact in the updated aliases, with an explicit migration pointer. The original amount and currency remain retrievable there. Replaying an original currency candidate must not make a new expense.

Both budgets are backed up before a durable pending intent. Create USD, sync, then retire CLP; while pending, all adapter mutation commands reject. Verify complete independent snapshots, dashboard invariants, exact identities and account deltas, then finalize the audit and aliases in one atomic state save. Exact completed retries are read-only. Pending intents do not retry automatically: an operator must inspect both budgets and backups. Alternative contra-entries preserve original IDs but inflate gross income/expenses; independent deletion and new creation without an audit risks source loss and is rejected.

## Risks / Trade-offs

- Cross-budget writes are not atomic → durable pending audit, global mutation guard, backups, and explicit manual recovery.
- Other Actual clients can write concurrently → pre-write and post-sync full-snapshot checks; no claim of server-side compare-and-set.
- Old amendment replays reference the old ID → retain old audit and snapshots; reject stale or cross-budget source candidates instead of rewriting history.

## Migration Plan

Test isolated fake budgets and failure stages first. Run read-only plan against fresh downloads, review exact accounts, categories, sources, currencies and dates; commit one case at a time under the existing lease. Independently verify each, then reconcile notes and email labels. On partial failure retain audit and backups; investigate before any recovery.
