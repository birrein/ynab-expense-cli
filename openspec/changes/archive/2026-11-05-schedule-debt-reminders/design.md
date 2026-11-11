## Context
The CMR restructuring has known future installment amounts but the outstanding principal and precise interest allocation are not yet reconciled. A categorized debit would create misleading expenditure.
## Goals / Non-Goals
Show only future due installments without posting transactions, treating the loan as a new purchase, or asserting an interest allocation. Past installments remain a separate reconciliation task.
## Decisions
Create one-off schedules on the CMR statement billing date with the exact confirmed amount and existing bank payee; no category and `posts_transaction:false`. Names identify the restructuring and pending allocation, source and installment number. Use a stable series key and retain review status. Validate account, source, date and amount; reject partial/duplicate/conflicting prior series. Require lease, lock, backup, full independent readback, unchanged transactions and balances, and verified schedule/rule identities. Repeated exact series is idempotent. Do not mark the source Registered while debt remains unresolved.
## Risks / Trade-offs
Dates after the last received statement are projections based on the confirmed monthly agreement; final amount remains subject to the last statement. A partial failure stops without retrying blindly.
