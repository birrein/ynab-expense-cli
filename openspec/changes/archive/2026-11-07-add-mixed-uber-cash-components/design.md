## Context

An original ride receipt is already included in the verified bank-cashflow record for its card portion. The standard source identity guard correctly refuses a second transaction but therefore cannot represent the independently evidenced wallet portion. The existing partial wallet is not a complete history or a statement balance.

## Goals / Non-Goals

**Goals:** Add exactly one missing wallet component per independently reviewed receipt while preserving the card record, and maintain auditable source ownership and interruption safety.

**Non-Goals:** Guess opening balances, reward dates, card sources, paid totals or the actual wallet balance; mutate prior ledger or Gmail labels automatically.

## Decisions

- A dedicated operation accepts exact current snapshots, stable receipt ID, full receipt total, wallet portion and statement reference; its durable group audit retains the shared identity instead of inventing a new Gmail source. Only the exact card row and ledger may reference that source before creation.
- Plan hashes bind candidate, all budget entities, dashboard and stable ledger. Before write, back up and revalidate, create durable pending intent, then add one wallet expense. A fresh client checks all old entities unchanged and wallet delta equal to the new expense. Completed retries verify their original row and card identity, without requiring an unchanged current balance.
- Reserve receipt IDs for all normal creation/removal paths and block financial writes while any mixed audit is pending, matching existing multi-stage safeguards. Fail closed if post-write verification is interrupted.

## Risks / Trade-offs

- A shared source is not by itself proof of a charge → require operator review of statement and full receipt; enforce exact source ownership and arithmetic.
- An interruption can leave an uncertain write → durable pending state, backup and explicit inspection, never blind retry.

## Migration Plan

Add tests and adapter routing, update runbook, validate OpenSpec and full suites, rehearse offline, then review and apply exact live plans separately. Archive after verification and documentation; never auto-restore a budget after an interrupted operation.
