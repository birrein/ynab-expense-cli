## Context

Legacy imports can consolidate multiple transfers into one linked pair, whereas bank statements and unique receipts show distinct operations. See proposal.md.

## Goals / Non-Goals

**Goals:** Preserve account balances while replacing only a fully identified unowned historical pair with individually evidenced pairs, with a durable interruption audit.

**Non-Goals:** Infer evidence from file identifiers, change accounts or dates, or automatically recover interrupted writes.

## Decisions

Require complete snapshots of both original legs, a checked statement, distinct receipt IDs and bank sources, matching component sum, and no unexplained nearby matching transactions. IDs are references, not content verification. Before mutation, acquire the lease, back up and compare a complete current snapshot; persist a pending audit. Delete the exact old pair and add individually sourced native pairs. A fresh connection verifies all pairs, unchanged balances and unrelated state before marking the audit complete. A pending audit blocks retry for manual investigation. An exact completed retry verifies without writing.

## Risks / Trade-offs

The API has no atomic multi-pair replacement; an interruption can leave partial changes. The pending audit, full backup and blocked retries prevent blind repetition, but an operator must investigate and recover if that happens.
