## Context

One native pair spans two accounts and its legs can have different cleared states. The installed official API does not automatically propagate the date when updating a linked transfer.

## Goals / Non-Goals

**Goals:** Change only both dates with exact source evidence and preserve every other field and balance.

**Non-Goals:** Correct reconciled or ledger-owned transfers, infer identity, or perform automatic partial recovery.

## Decisions

Require full snapshots, one-day correction within a month, unique receipt and statement references, and no unexplained matches. The operator inspects the actual documents. Back up, revalidate and write a pending audit before updating the two legs sequentially; sync and independently verify the complete snapshot before marking complete. Exact complete retries only verify; pending audits stop.

## Risks / Trade-offs

The API does not provide an atomic pair update; interruption can leave inconsistent dates. The pending audit blocks repetition and preserves a backup for investigation.
