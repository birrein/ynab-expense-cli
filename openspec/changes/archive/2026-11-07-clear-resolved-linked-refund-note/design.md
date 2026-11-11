## Context

The refund's first line was generated from the audited pending reason. Its category resolution already updates both transactions under durable intent.

## Goals / Non-Goals

**Goals:** Eliminate the now-stale pending line during the same audited update and retain all sources.

**Non-Goals:** Free-form note editing, removing tags or links, changing amounts or bank balances.

## Decisions

Derive the exact prefix from the immutable original refund audit. Require the original refund notes to match the audited notes exactly and to begin with that prefix. Remove that prefix only; include the result in preview, update the refund category and notes together, and require exact readback and retry verification.

## Risks / Trade-offs

- A note changed since verification must not be overwritten: reject a changed snapshot or unexpected prefix before writes.
