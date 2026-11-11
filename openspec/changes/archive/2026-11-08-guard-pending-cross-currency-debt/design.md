## Context

Transfer creation is protected by a pending intent, but only a retry of the same reference checks it. Other mutation entrypoints can currently proceed despite an unresolved half-transfer.

## Goals / Non-Goals

**Goals:** Ensure all adapter financial mutations fail before connecting or writing if any transfer audit is pending.

**Non-Goals:** Automate recovery, delete a pending audit or block read-only inspection and lease closure.

## Decisions

Use the existing authoritative state and check it under each mutation's existing exclusive lock in `apply`, `remove` and `adopt-budgets`. Reject all pending entries, including unrelated transfer references. Tests invoke all three commands in an isolated temporary state with no server and verify that normal completed audits do not block inspection. No new lock or recovery mode is introduced.

## Risks / Trade-offs

- Independent Actual clients are outside the adapter lease → document and retain existing post-write checks.
