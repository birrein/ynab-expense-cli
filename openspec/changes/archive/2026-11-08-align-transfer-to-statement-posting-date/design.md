## Context

The audited posting-date operation supports updating one leg. Bank statements can both post later than the receipt and both original legs.

## Goals / Non-Goals

**Goals:** Align a single existing reciprocal transfer to a posting date confirmed by both banks and protect partial updates.

**Non-Goals:** Infer posting dates, create transfers, or change amounts, identities, categories or unrelated state.

## Decisions

- Extend the posting-date operation with explicit evidence of original receipt date and both identical posting dates; restrict the later correction to one to four days.
- Use existing full-state plan hash, lease, backup, pending intent and independent verification. Update legs sequentially under a single durable pending audit; do not retry interrupted operations automatically.
- Verify full state, balances and daily deltas across both accounts; test API persistence and failures after the first update.

## Risks / Trade-offs

- [A posting date may correspond to another payment] → require the operator to review receipt and both complete statements and reject nearby equal-amount competitors.
- [Two updates are not atomic] → pending audit blocks all further financial mutations after any failure; inspect backup before recovery.
