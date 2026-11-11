## Context
The Go CLI currently talks directly to YNAB while the existing Node adapter owns Actual locks, leases, provenance, backups and readback. Official Actual access is Node-based. Seven October one-off schedules are overdue, one differing by CLP1.

## Goals / Non-Goals
**Goals:** Expose Actual via Go, preserve one financial writer, support safe exact-schedule installment posting with replay safety.
**Non-Goals:** Change YNAB behavior, implement an unofficial Go sync client, alter server configuration, infer mismatched charges, or rewrite historical sources.

## Decisions
The Go command proxies explicit supported adapter arguments using exec without a shell; the adapter remains the sole writer and retains its existing environment and Node version requirements. Each posted installment uses a stable source keyed by statement and bank reference, stores original statement/source evidence and is linked through the official API schedule field. Preview and commit both revalidate account, schedule, payee, exact date and amount, rule/category and absence of matching postings. An exact prior linked result is recoverable without another write. Compare independent before/after snapshots and balance; preserve schedule rules and data. Mismatched Decathlon amounts stop for review.

## Risks / Trade-offs
A failure between transaction creation and association could leave a partial state: recovery must identify the same stable imported ID, never create another charge. Actual import and schedule APIs require verification against real documented semantics before live use. The existing runbook and untracked files must be preserved.

## Verified implementation note
Actual may complete and reorder the target one-off schedule after its linked transaction synchronizes. Readback compares schedules by ID and allows only the target completion flag to change. If the first verification stops after a write, the exact saved candidate and its original backup are used to verify and recover the audit without another transaction. In an isolated copied budget the transaction link and retry were verified with synchronization simulated; a live interrupted verification was subsequently recovered from the original backup.
