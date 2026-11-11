## Context

Imported historical expenses may have no imported ID or Gmail ledger entries. Existing Gmail mutation preconditions must remain unchanged.

## Goals / Non-Goals

**Goals:** Permit an exact-match, single-tag amendment with full readback and a separate durable audit.

**Non-Goals:** Fabricating sources, registering expenses, moving money, or changing existing Gmail validation.

## Decisions

Use a separate operation and audit keyed by transaction ID in the state, with explicit nullable imported ID. Reject any ledger-linked transaction. Reuse existing backup, lease and write-lock orchestration. Compare the complete snapshot and preserve the old notes verbatim as suffix.

## Risks / Trade-offs

[Historical identity has no ledger provenance] → Require all identity fields, full original notes and explicit evidence; reject changes since preview. [Write may succeed before audit] → retry the same candidate and independently re-read before recording recovery.
