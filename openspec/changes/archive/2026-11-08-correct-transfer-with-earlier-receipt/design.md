## Context

The common posting-date mode already verifies both reciprocal legs with full state and audit controls, but requires the receipt date to equal the historical date.

## Goals / Non-Goals

**Goals:** Support exactly one prior receipt day and at most four days to the common statement posting.

**Non-Goals:** Accept ambiguous payments, change one leg, infer the receipt date, or combine exception modes.

## Decisions

Add an explicit `receiptBeforeHistorical:true` guard to common posting evidence, require distinct statements and test for competitors near the receipt, old and posting dates. Reuse the existing state hash and two-leg audit workflow.

## Risks / Trade-offs

- [IDs do not prove evidence] → The operator inspects receipt and both statements and documents the match.
- [Competing transfer] → Extend collision checks to the receipt and historical dates and refuse any collision in this mode.
