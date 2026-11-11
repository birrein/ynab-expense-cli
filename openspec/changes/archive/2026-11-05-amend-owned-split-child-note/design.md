## Context

Existing safe note amendments cover parents and simple expenses; children in a ledger-owned split require their own bounded operation.

## Goals / Non-Goals

**Goals:** Correct one child description while preserving all financial and source data.

**Non-Goals:** Altering category, amount, source, parent notes, or other children.

## Decisions

- Validate exact parent, source ledger records, child identity, and a single safe text replacement. Revalidate after backup, update the child through the official API, then compare the independently downloaded full snapshot against the expected one.
- Persist a durable idempotent audit; an altered child without matching audit is never silently retried.

## Risks / Trade-offs

- Child mutation could affect its parent → verify the complete parent and all unrelated budget structures and balances.
