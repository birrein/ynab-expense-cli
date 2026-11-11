## Context

The existing correction requires previous and next snapshots, a verified statement and purchase receipt, and an exact ledger audit. A last installment has no next snapshot.

## Goals / Non-Goals

**Goals:** Accept a final installment of a series of at least three while retaining current invariants and retry guarantees.

**Non-Goals:** Correct first installments, alter amounts, accept weak evidence, change other transactions or reconcile balances automatically.

## Decisions

For the terminal case use `previous` and `previous2` snapshots, require `number === total >= 3`, omit `next`, require consecutive months and identities, and verify normalized signatures for n-1 and n-2. For nonterminal cases preserve the existing exact contract and reject `previous2`. Reuse existing backup, audit, revalidation and readback implementation without changing it.

## Risks / Trade-offs

- Incorrect series association → require exact preceding snapshots and signatures plus independently reviewed purchase and statement evidence.
- Concurrent changes or interrupted writes → preserve existing full snapshot comparisons and pending audit fail-closed behavior.
