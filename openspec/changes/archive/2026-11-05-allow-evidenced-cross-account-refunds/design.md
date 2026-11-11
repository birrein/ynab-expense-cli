## Context

Existing refund processing is source-deduplicated, backed up and independently read back, but assumes the original account.

## Goals / Non-Goals

**Goals:** Extend the existing refund flow narrowly, preserving its category and accounting semantics.

**Non-Goals:** Inferring account ownership, accepting split originals, or representing refunds as transfers.

## Decisions

The candidate must explicitly identify the original account and separate merchant and destination-bank message IDs, both included in sourceIds. The source identity is confirmed against the live original and destination account. Prior linked refunds across accounts count against the same ceiling. Default behavior remains unchanged. Evidence contents must be inspected by the operator; strings alone cannot prove settlement.

## Risks / Trade-offs

Incorrect interpretation of documents → require human evidence review, distinct sources, preview and independent verification. Reusing a source → existing imported-ID and duplicate protections remain active.
