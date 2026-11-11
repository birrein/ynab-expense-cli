## Context
A bank transfer was entered as a single categorized expense after two preexisting historical components had already represented it. The complete statement contains a single transfer equal to their sum.
## Goals / Non-Goals
**Goals:** remove the exact aggregate without losing its source, preserve components, avoid recreation and verify the full budget.
**Non-Goals:** infer matches, change component categories, handle transfers or splits, or silently alter unrelated records.
## Decisions
Candidate includes exact aggregate identity, source and at least two complete component identities, verified statement and evidence. Require exact account, date, payee, simple unreconciled rows and exact sum. Back up and revalidate; remove aggregate through official API, verify independent snapshot and store a superseded entry including original ledger, components and backup. Retry requires exact audit.
## Risks / Trade-offs
Loss of a component source or expense category would be unacceptable; retain the components unchanged. An interrupted write fails closed pending inspection.
