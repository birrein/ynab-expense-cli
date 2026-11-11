## Context
A line draw and another incoming transfer share amount and destination within four days, but statement dates and separate origins distinguish them.
## Goals / Non-Goals
**Goals:** retain duplicate guard except for an explicit, verifiable pair and two statement sources.
**Non-Goals:** automatic inference, bypassing additional matches, changing earlier transactions.
## Decisions
Add a separate narrowly typed distinctStatementTransfer candidate with exact existing pair, source ID in existing notes, existing statement posting date and shared statement ID. Require different dates, allow only one-day posting lag, different origins, and the unique matching destination leg. Revalidate live after backup; independently verify unchanged records.
## Risks / Trade-offs
Source IDs prove identity but the operator must verify the statement contents. Fail closed for incomplete or conflicting evidence.
