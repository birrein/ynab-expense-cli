## Context
The existing transfer-date planner rejects any same-amount collision within four days. That is correct unless independent sources prove a distinct same-value transfer.

## Goals / Non-Goals
**Goals:** Permit a narrow explicit distinction for different source accounts sending equal values to the same destination; retain strict fail-closed coverage and full independent verification.
**Non-Goals:** Infer identities from sums, accept same-source peers, create or modify any peer, or relax default duplicate checks.

## Decisions
An optional `distinctTransferPeers` array contains complete `oldOrigin`, `oldDestination`, `receiptId` and `evidence` for each competitor. Each pair must exist exactly in the snapshot, be reciprocal, same destination and amount but different origin, use a distinct Gmail receipt, and its destination must be a collision according to the existing window. Verify transfer payees and active accounts; unique origin, peer IDs and receipt IDs prevent list reuse. Compare the set of all actual collisions to the peer destination IDs, rejecting omitted, extra and unrecognized matches. Full snapshot hash and independent readback already protect peer fields. The operator must inspect both receipts and statement rows; IDs are not proof. The prior-audit verification path also validates linked peer evidence before trusting a completed audit.

## Risks / Trade-offs
- Incorrect human attribution of identical statement rows → require distinct receipts with origins and target plus the two statement credits and preserve ambiguity when absent.
- Stale peer or omitted collision → snapshot equality and exact coverage reject the plan.
- Future peer edits could make a retry fail closed → documented conservative behavior; no automatic recreation or rollback.
