## Context

Existing FX retirement requires the original USD amount in both notes; this historical note never contained it. The bank-backed charge has an independent cashflow ledger record and its category must be resolved separately first.

## Goals / Non-Goals

**Goals:** Permit the narrowly corroborated one-peso discrepancy without changing or fabricating old notes; retain all source and audit controls.

**Non-Goals:** Automating receipt interpretation or treating user confirmation, numerical similarity or identifiers as proof of the complete evidence.

## Decisions

Use an exclusive mode on historicalDuplicateExpenseRetirement. Require exact old snapshot fields, equal account/date/payee/category, receipt Drive ID, item text present in both notes, explicit confirmation text and statement source in the verified cashflow. Enforce integer pesos and at most CLP 1 difference. Require the retained notes to include the statement and the item description; record receipt ID, confirmation and operator evidence in audit. The operator inspects receipt and statement and resolves category with the existing protected flow first. Continue using existing backup and independent full-budget verification.

## Risks / Trade-offs

A confirmation or source ID alone cannot prove a bank transaction matches a receipt; require operator review and fail closed if identity is doubtful. An interrupted mutation requires inspecting backup and audit before any retry.
