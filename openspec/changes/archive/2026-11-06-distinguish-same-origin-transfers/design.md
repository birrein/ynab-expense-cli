## Context
The existing cashflow classifier rejects any equal debit in the origin near a candidate even if the bank shows two different rows. Existing historical pair is reciprocal but has no imported source.

## Goals / Non-Goals
Allow only exact historical pairs to a different account when the operator independently inspected two rows on the same origin statement and a separate recipient report. Do not create or change source IDs for the old pair; do not alter any old movement or bypass other collisions.

## Decisions
Use an exclusive `distinctSameOriginTransfer` object containing statement and independent recipient report IDs, exact snapshots of both existing legs, distinct statement descriptors and explicit evidence. Compare exact live snapshots, same origin/date/amount, reciprocal payees and active distinct destinations, and require the existing origin as the complete conflict set. Preserve the object in the private audit. Reuse the existing source, backup, lease, prewrite revalidation and independent full-budget verification. An unrestricted reason or a date/amount-only match was rejected as unsafe.

## Risks / Trade-offs
Identifiers and descriptors cannot prove document contents; an operator must read both independently. A stale snapshot or extra match stops the operation. A crash after write requires source and backup inspection rather than changing the source to force retry.
