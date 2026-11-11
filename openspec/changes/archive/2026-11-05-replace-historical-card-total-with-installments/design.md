## Context

The official Actual adapter already performs leased, backed-up, independently verified corrections. Existing installment deduplication assumes that the individual installments already exist, so it cannot safely fix a lone historical total. Some other historical totals are split transactions and need separate accounting treatment.

## Goals / Non-Goals

**Goals:** Safely convert a simple, unowned historical total into its complete statement-backed billed installments; retain the original ID and categorization, avoid changes in aggregate balances, and fail closed during interrupted operations.

**Non-Goals:** Split parents or child transactions, mixed categories, uncertain schedules or future unbilled installments, edits to other budgets, and automatic evidence inference. The operator remains responsible for inspecting the actual source documents.

## Decisions

1. Keep the original ID as installment one, changing its date, amount and notes and assigning its previously absent imported ID to the stable first-installment source; create the remaining transactions with stable source IDs. This retains the historical identity and makes every source searchable. Deleting and recreating every entry would discard identity and worsen interrupted-write recovery.
2. Require a complete consecutive set of distinct statement IDs, integer amounts whose sum equals the original, and a separately supplied stable source for each line. Reject existing nearby matching charges and ledger ownership instead of attempting to merge ambiguous data.
3. Before any mutation, save the exact candidate, prior snapshot and `pending` audit under lease and lock. If interrupted, stop for inspection rather than automatically resuming multi-step financial writes. An exact completed audit permits read-only idempotent verification.
4. Independently download and compare the entire budget, preserving all unrelated transactions, rules, schedules, accounts and balances. Record the resulting IDs and exact candidate in the audit only after validation.

## Risks / Trade-offs

- Partial API writes are possible because multiple official API calls are required → durable pending audit, backups, fixed source identities and no automatic retry.
- Evidence identifiers are not themselves proof → operator must read every statement and purchase document before preview.
- Date boundaries can make close-match tests conservative → reject ambiguity; do not add manual overrides in this change.
- Mixed-category historical splits need a different operation → leave them unchanged and explicitly out of scope.
