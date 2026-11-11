## Context

The existing different-merchant exception requires both receipts attached to transaction notes; older transactions often predate source links. The operator can instead read a shared statement and the original receipt of the one exact legacy match.

## Goals / Non-Goals

**Goals:** Record a single distinct statement-backed expense without changing the matched historical transaction or pretending its receipt belongs to the new charge.

**Non-Goals:** Infer receipt or statement contents from IDs, support ambiguous or same-date matches, alter existing transactions, or weaken source idempotency.

## Decisions

Add `distinctLegacyStatementExpense` with a complete exact legacy snapshot, verified prior receipt ID, two different bank descriptors, statement ID and evidence. Require one live matching simple expense, matching account and amount, different valid date and payee, no imported ID, target payee uniquely resolved, distinct descriptors, and the actual shared statement in Drive evidence. The operator independently verifies both bank rows and original receipt. Reuse existing revalidation, backup, sync and independent whole-budget readback; store the exception only in the audit, not as the new charge's receipt. Exact retry must not duplicate.

## Risks / Trade-offs

Source identifiers and transcribed descriptors do not prove their content; operator verification remains essential. Another live match or changed snapshot prevents writing.
