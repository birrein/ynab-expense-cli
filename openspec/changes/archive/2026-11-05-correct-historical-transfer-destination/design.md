## Context
A previously imported transfer points directly to CMR, but bank receipts prove BCH to Falabella checking followed by the existing Falabella to CMR transfer. Actual's API can retarget an existing transfer by updating the origin's transfer payee.
## Goals / Non-Goals
Correct only a verified historical pair without changing amounts, IDs, notes, or the existing CMR payment. Do not change arbitrary source-ledger transactions.
## Decisions
Require exact pair IDs and all old account/payee/date/amount/notes/imported fields, an existing downstream pair, and evidence from both institutions. Reject split, ledger-owned, mismatched or reconciled transactions. Retarget via official API with lease, lock, pre-write full snapshot and backup. Verify after independent download: exactly the origin payee and reciprocal leg account change; all other data remains equal, balances move only from old to new destination, and IDs remain stable. Recover the audit idempotently if already applied; never change source IDs.
## Risks / Trade-offs
API transfer side effects or asynchronous balance caches must cause a hard stop and source-based recovery; offline testing and independent server readback are required before accepting success.
