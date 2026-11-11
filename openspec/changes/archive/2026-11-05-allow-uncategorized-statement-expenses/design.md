## Context
The statement-backed cashflow adapter already supplies stable bank-row source IDs, evidence and full duplicate protection, but insists on a category even where no category is supported.
## Goals / Non-Goals
**Goals:** record a confirmed statement expense without inventing a category, retaining a reason and review status.
**Non-Goals:** accept ambiguous account, charge or reversal; infer categories or change existing category resolution behavior.
## Decisions
Allow null category only for expense, require a nonempty categoryReason, include it in notes and audit, and return Review status. Reuse existing writer, duplicate checks and full independent verification.
## Risks / Trade-offs
Operators must confirm settlement and account from the source. Unknown category never bypasses identity and duplicate checks.
