## Context
The daily adapter has separate cashflow and Gmail source ledgers; existing generic resolution only updates the Gmail ledger and cannot safely resolve bank-sourced cashflows.

## Goals / Non-Goals
**Goals:** Resolve only an exact uncategorized verified cashflow into a balanced split, preserving parent source identity and durable provenance, with a full independent readback.
**Non-Goals:** Recreate the expense, infer category allocation, mutate unrelated state, bypass write locks, or migrate unrelated cashflows.

## Decisions
Use a dedicated mutually exclusive candidate with exact original transaction and cashflow ledger identity, two or more explicit split lines and user-supported evidence. Require active non-income categories and disallow transfers, children, parent transactions, reconciled transactions and schedules. Preserve parent notes and remove stale pending-category wording using a separately validated exact textual replacement while retaining all source URLs and tags. Revalidate after backup; use official API, poll for eventual update, sync and compare the independently downloaded complete budget. Audit stores full candidate and backup, and only then updates ledger status/category representation. If verification fails after write, refuse retries without verified audit for manual recovery.

## Risks / Trade-offs
Upstream split materialization is asynchronous and may normalize child properties: poll, then verify independently. A crash after write may leave an unaudited result: stop rather than issue a second write. Global or unclear discounts require explicit user direction and transparent allocation, never inferred exact product discounts.
