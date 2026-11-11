## Context

The existing adapter can create verified credit-line accounts, transfer cashflows and non-posting debt reminders, but deliberately does not infer a loan from card-only transactions. The source contract gives total principal, installments and the rate; statements give dated billed amounts and aggregate credit usage. A loan-specific operation must not pretend that a calculated amortization table was issued by the bank.

## Goals / Non-Goals

**Goals:** Support transparent, auditable booking of an evidenced refinancing and the installments already billed; display and preserve explicit source calculations and unresolved discrepancies.

**Non-Goals:** Reconcile unknown older card transactions, make payments, change historical expenses, claim later installments are paid, or assert that a modeled allocation is the bank's own amortization table.

## Decisions

- Represent the card credit as a transfer from a dedicated on-budget liability account to the card. A balance adjustment or uncategorized income would distort income; booking all gross installments as new expenses would duplicate historical principal.
- Each billed installment is one split parent on the card, with principal transferred to the liability and a separately categorized finance charge. An isolated offline official-API experiment confirmed that `addTransactions` with `runTransfers:true` creates a linked counterpart for a transfer child, while the card balance changes by the parent amount and the liability by the principal only. Verify those links and totals on independent readback; deterministic identities must not create a second gross expense.
- Require the candidate to include the contract, statement IDs, amounts, cutoff reconstruction and explicitly modeled interest for each installment. The preview shows per-installment gross, principal, interest, resulting liability and evidence confidence, including any unresolved 6- or 12-peso discrepancy. It cannot assume all credit usage is loan principal: other unbilled purchases and returns must be identified.
- Reuse the adapter's official Node API bridge, lock, lease, backup, full snapshot and independent readback. The operation is restart-safe only if a complete ledger audit and all stable transaction identities match; partial states halt for investigation.
- Account creation and financial posting must be verified as one controlled workflow with clear partial-failure audit, avoiding use of unrelated accounts. Existing reminders 8–12 remain non-posting and no historical card purchases or payments are changed.

## Risks / Trade-offs

- [The bank does not publish an amortization table in the available documents] → Label the allocation as inferred and verify it against several independent statement cuts, the contract rate and bank total. Do not represent it as bank-certified.
- [A statement's credit usage may include unbilled purchases] → Show and reconcile every adjustment, including the next-cycle OpenAI charge; halt where attribution is not proved.
- [Existing pre-refinancing balance has a material unexplained gap] → Preserve and report it independently; recording the bank credit and installments is not a reconciliation or justification for a balancing adjustment.
- [Two account entries per installment may be mistaken for duplicate charges] → Use explicit linked notes, stable identities and an audit tying principal plus interest to one bank line; confirm reports do not count transfers as expenses.
- [Failure after any API mutation can leave a partial write] → Snapshot and record intended identities before writes, re-download independently, and never retry without checking actual source and audit.
