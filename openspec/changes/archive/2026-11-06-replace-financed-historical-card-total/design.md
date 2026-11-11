## Context

The existing adapter replaces a simple historical card transaction with an exact, already billed series, keeping its ID and rejecting differences. It assumes a Gmail receipt and unchanged balances. Financed purchases may have a higher billed total and an image receipt in Drive.

## Goals / Non-Goals

**Goals:** permit an explicit, evidenced cost and a Drive evidence declaration with independent full-budget verification. Preserve every previous invariant and fail closed on partial application.

**Non-Goals:** infer a monthly interest/principal allocation, create debt accounts, change category, post future installments, modify split or reconciled transactions, or loosen deduplication.

## Decisions

An optional `financedPurchase` object binds receipt file, original identity, account, purchase date, price, card suffix, installment count, and positive additional financed cost. It replaces the Gmail receipt declaration only for this mode. Each note identifies the same series-level cost without assigning per-month interest. Original category is retained for the entire billed amount, consistent with existing installment treatment; the cost is visible in notes and audit. The alternative of a principal/interest split would invent a monthly allocation absent a bank schedule.

Total installment amounts must equal original signed amount minus cost; returned preview makes the delta explicit. The independent snapshot comparison adjusts only the target account's expected balance; every other account, transaction, rule, category and schedule must match. Pending audits and exact retry use the existing operation and original ID. The operator verifies receipt and all statements, because field checks alone cannot establish documentary truth.

## Risks / Trade-offs

- Series-level financing cost is categorized with the purchase and therefore cannot be isolated by category reports; notes and audit disclose it. A verified bank allocation can support a later audited correction.
- Receipt may not name the card: require independent statement identity and exact purchase date, gateway and total; mismatched or ambiguous sources block use.
- Interruption after the original changes blocks retry and requires audit/backup inspection.
