## Context
Two bank statements support historical credit-line principal transfers; the origin payments exist as source-bearing expenses. The official API creates the reciprocal leg asynchronously when changing the payee to a transfer payee.

## Goals / Non-Goals
**Goals:** exact identity, evidence, no duplication, safe backup, complete independent verification and audit.
**Non-Goals:** infer dates or link an existing destination row; alter other transaction fields or create debt adjustments.

## Decisions
Require two Drive IDs and exact transaction metadata; allow a stated one-day posting difference from the existing date. Reject any matching destination candidate in a four-day window. Use the official updateTransaction and wait for its linked result before syncing. Compare unchanged origin fields, reciprocal leg, all other transactions and both balances after independent download. Reject retries without an exact completed audit.

## Risks / Trade-offs
The API update returns before its asynchronous operation completes. Bounded polling and post-sync independent readback are mandatory; if a write fails or verification is incomplete, investigate by source and backup, never retry with a changed identity.
