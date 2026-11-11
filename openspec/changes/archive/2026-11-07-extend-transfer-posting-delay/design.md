## Context

The previous change supports cross-month operation and posting dates separated by at most three days, with a payment receipt and two distinct statements.

## Goals / Non-Goals

**Goals:** Support a verified four-day delay without weakening identity, uniqueness or audit controls.

**Non-Goals:** Infer holidays, declare unexplained differences reconciled, or permit broader arbitrary date moves.

## Decisions

Extend only the upper bound to four calendar days; all existing evidence and earlier-month restrictions remain. A general date override would be unsafe.

## Risks / Trade-offs

Identifiers alone do not prove source contents → the operator independently checks the receipt and both statements before planning.
