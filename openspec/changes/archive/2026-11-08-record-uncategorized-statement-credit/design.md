## Context

The cashflow adapter supports uncategorized expenses but requires a positive cashflow to have an income category. Statement discounts can be genuine credits without an identifiable related purchase. Existing source reservations, full snapshots and independent clients are the safety boundary.

## Goals / Non-Goals

**Goals:** preserve correct account balance and source evidence while preventing invented category or income attribution; permit evidence-based later resolution.

**Non-Goals:** infer the associated purchase, change bank configuration or alter historical cashflows and other budgets.

## Decisions

- Use an explicitly named statement-credit operation with positive amount and null category, instead of weakening ordinary income validation or fabricating an income category. Require a stable unique statement-row source and Drive statement, exact account and explicit review reason.
- Use a durable pending intent before posting; all financial entry paths must reject a reserved source until full verification. An exact completed retry is read-only. Preserve full before/after snapshots and all unrelated data.
- Keep later category resolution as a separate operation with exact transaction and ledger snapshots and a distinct audit; allow an expense category for a rebate only when its purchase/category is supported, and require income category only for independently proven income.
- Isolated Actual API testing showed a positive uncategorized transaction changes the account balance but not `incomeAvailable`, `totalIncome`, `totalSpent` or `toBudget`. AQL queries used by the income summary do include that transaction even with the existing category exclusions. Thus writing it alone would misstate the income indicator for a period containing the credit.
- Before any live write, implement and exercise an exact, reversible exclusion tied to the stable transaction source in all applicable income widgets. Preserve unrelated filters and widgets; bind the plan to the complete dashboard state and verify independently after the transaction and widget changes. Do not exclude the credit from net worth. If a relevant widget cannot safely express the exclusion, refuse the entire operation.
- On subsequent category resolution, reconsider the exclusion based on established economic nature, without silently changing unrelated dashboard filters. Record the prior and resulting widget snapshots in the audit.

## Risks / Trade-offs

- [Unlinked credit may already be embedded in a net historical transaction] → inspect the whole statement, nearby entries and source ledger; refuse ambiguous matches.
- [Partial write or concurrent change] → reserve source with durable intent, lock, revalidate and independently compare complete snapshots; require investigation on interruption.
- [The income summary includes uncategorized credits] → block live use until exact-source exclusion is tested on the actual widget semantics and independently verified; document that arbitrary user-created reports outside inspected dashboards may still require their own filters.
