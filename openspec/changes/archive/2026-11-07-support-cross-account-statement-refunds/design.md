## Context

The existing statement refund operation uses a verified cashflow-owned purchase and the same account; the existing cross-account operation requires a bank message. A categorized Gmail-ledger purchase and a separately inspected destination statement cannot currently be combined.

## Goals / Non-Goals

**Goals:** Support one categorized, simple, verified Gmail-ledger purchase and its independently evidenced positive refund to a different active account, without changing the purchase or other data.

**Non-Goals:** Infer a category, make a transfer, support split purchases, reinterpret unknown credits, or use document IDs as a substitute for inspecting the actual evidence.

## Decisions

- Add a dedicated operation with exact original transaction and ledger snapshots, merchant refund message, destination statement, shared payment reference, line-level stable bank source, and explicit evidence. A separate operation keeps existing modes unchanged and avoids falsely representing a statement as a Gmail message.
- Require a categorized original and matching registered ledger; resolve category separately under its existing controls. Null categories cannot be used for this refund.
- Reject same-account input, unaudited or nearby duplicates, conflicting ledger sources, stale state, missing accounts or payees, and total refunds exceeding the original, including refunds already linked across accounts.
- Under the existing lease and outer lock, back up, revalidate the full budget, persist an intent, write a single positive entry in the destination, sync and independently compare all unrelated records, both balances and ledger. Exact completed retries verify only; pending intent blocks.
- Bind apply to a SHA-256 hash of the reviewed plan, candidate and complete snapshot. Recompute before backup and reject changed state. The adapter lock does not exclude other clients; an external write after revalidation can only be detected by independent readback and leaves a pending audit.

## Risks / Trade-offs

- A source identifier alone is not evidence → the operator must inspect the merchant record and statement and document identity, amount, destination and dates before planning.
- A partial write can leave a refund without completed audit → persist intent first and stop retries until investigated.
- A returned purchase is still a historical charge → keep its original date, account and ID and place the credit in the same category when resolved.
