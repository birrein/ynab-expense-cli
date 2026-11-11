## Context
The confirmed three-part Decathlon series totals CLP47,900; the statement and user authorize moving CLP1 from the first to the last installment. Existing one-schedule amendment requires each intermediate total to be final, and cannot safely express a two-schedule transfer.

## Goals / Non-Goals
**Goals:** exact preconditions, preserve notes and sources, update schedule and corresponding amount conditions, independently verify, recover partial attempts.
**Non-Goals:** create a transaction, adjust other purchases, modify future billing dates or claim future bank billing is already confirmed.

## Decisions
Implement one adapter operation under the existing lease and lock. An exact private candidate enumerates every schedule and rule with old/new amounts and names. Reject any unexpected or already posted state. Back up before mutation; apply both schedule/rule changes and sync, then compare the full snapshot. Retry recognizes old/new subsets only when backed by an exact prior candidate and original snapshot; never infer state. Record an audit while preserving source ledger records. Only then use the separate posting operation.

## Risks / Trade-offs
Synchronization can fail after a partial remote change: retain the backup and exact candidate, stop further processing and recover only after inspection. Future last installment is a user-authorized allocation, not a new bank-confirmed statement.
