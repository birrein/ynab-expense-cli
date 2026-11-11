## Context
Existing category resolution operates on a distinct Gmail ledger; bank cashflows need exact identity and their own audit.
## Goals / Non-Goals
**Goals:** Update one reviewed cashflow and a matched stale note while preserving source and audit.
**Non-Goals:** New expense creation, changes to transfers, splits, reconciled movements or inferred evidence.
## Decisions
Dedicated operation compares the exact full old transaction and verified cashflow ledger, requires an active category and protects links/source lines/tags. It uses official API, backup and revalidation under writer lease, waits for update, syncs and compares full independent snapshot before writing the audit. Fail closed after uncertain writes.
## Risks / Trade-offs
Asynchronous writes and post-write errors require polling and refusal to repeat until state is inspected. Existing ledger history is extended, never replaced.
