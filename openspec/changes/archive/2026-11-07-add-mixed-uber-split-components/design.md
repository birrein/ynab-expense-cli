## Context

The verified original card component has a Gmail imported ID, one split parent and two children. The same receipt must identify the wallet split; it cannot be replaced with a fabricated source. An isolated official API experiment confirmed that two accounts can each hold a distinct split with the same imported ID.

## Goals / Non-Goals

**Goals:** Preserve existing split and its source ledger; reproduce whole-order proportional category totals without adding the full order twice.

**Non-Goals:** Infer actual wallet balance, attribute wallet credits, change historical card rows, or claim a discount was allocated by the merchant.

## Decisions

- The candidate records original parent, nested children and source-ledger snapshots, receipt, statement, exact gross category weights, total, card amount and wallet amount. Largest remainders are computed for the whole order, then the existing card category values are subtracted. Reject negative or nonintegral residuals and any unverified extra category.
- A separate durable audit reserves receipt, original parent, child IDs and created wallet parent/children across other operations. Plan binds all budget data, dashboard and stable ledger. Backup and revalidation precede pending intent; fresh independent readback compares all original rows and balances, created split structure and category totals.
- A pending audit blocks every financial write until investigated. Original card ledger is retained exactly; completed retry verifies original and new split identities but does not require unchanged present wallet balance.

## Risks / Trade-offs

- Whole-order allocation is an accounting estimate → document the gross subtotals and method, not a merchant-provided allocation.
- Multiple split writes may be interrupted → single API call, durable intent, backup and full independent readback; no blind retries.

## Migration Plan

Add negative and official-API isolated tests; validate full suite and spec; inspect receipt, statement, source and current budget; plan and apply once; document; archive only after readback.
