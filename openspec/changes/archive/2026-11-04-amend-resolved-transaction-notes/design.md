## Context

Existing notes operations require every source in notes and reject split parents. The ledger stores verified source identity even when the live notes lack one link.

## Goals / Non-Goals

**Goals:** Safe prose-only repair for resolved simple and split parents, preserving source lines, tags and all children.

**Non-Goals:** Editing category, sums, split children, adding sources or changing ledger associations.

## Decisions

Use a distinct operation requiring exact ledger source IDs, imported ID, all identity fields, and complete children for a split. Check source lines are a subset of ledger sources; reject duplicate or unexpected sources. Compare the entire budget before/after and append audit to existing ledger records. Require provenance of sources in registered ledger rather than fabricating source links.

## Risks / Trade-offs

[Missing source in note] → ledger identity and verified registration required, never create a link. [Concurrent modification] → synchronized exact snapshot and full independent re-read; preserve lease and lock.
