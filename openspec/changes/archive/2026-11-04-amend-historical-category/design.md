## Context
The adapter already has a historical tag amendment with full-budget verification; old transactions may have null payee and imported ID.
## Goals / Non-Goals
Allow explicit correction of a simple historical expense. Exclude transfers, splits, other budget changes and source-ledger transactions.
## Decisions
Use the existing adapter's plan/apply and historical identity strategy. Require exact old category, account, date, amount, payee, imported ID and notes plus evidence and user authorization. Permit null payee/imported ID; reject hidden or income target categories. Back up before update, check unchanged snapshot, lock and lease; sync and compare a fresh independent full snapshot with only category changed. Audit in state; retry recognizes the same target and is idempotent. Keep notes and source intact.
## Risks / Trade-offs
An imported historical transaction lacks source identity; explicit account/date/amount/id and bank evidence mitigate mistaken identity. Any concurrent change stops the write or readback.
