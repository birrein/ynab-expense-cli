## Context

The existing adapter creates negative splits and separately supports simple refunds. Positive split refunds and two new linked bank-dated transactions are not supported together. The official API accepts split parents and children; the operation must stop safely if only one leg is created.

## Goals / Non-Goals

**Goals:** Record exact charge and refund dates, final receipt categories and the user-approved proportional allocation; preserve authoritative evidence and avoid duplicate sources and amounts.

**Non-Goals:** Infer which items were refunded, change an existing transaction, imply a proportional allocation was provided by the store, or perform general multi-step recovery automatically.

## Decisions

- Use a dedicated candidate with separate Gmail source groups for the purchase and settlement, statement ID, exact account/payee/category IDs and category net/refund allocations. Gross category amounts equal net plus refund; refund allocation is proportional to net, rounded by less than one currency unit per category.
- The operator must inspect the full receipt, charge and settlement statement and the provider explanation. A source ID is not evidence of its content. The plan exposes both parents and all child amounts and source links.
- Check all source ownership and nearby same-account gross, refund and net amounts before mutation. Require unique categories and sources, exact sums, same currency and a later/equal refund date.
- Back up and persist a pending intent under the run lease before any write. Create the charge, identify its parent ID and then create the refund linked to it. Sync and reopen independently; verify both full parent/child structures, every prior transaction, all unrelated budget data, account balance delta, source ledger and durable complete audit. A pending or partial intent requires investigation without retry or source changes; a completed exact retry is read-only.

## Risks / Trade-offs

- [Store allocated the global discount differently] → Describe this as a proportional accounting estimate and retain exact final receipt totals by category.
- [Failure between the two financial writes] → Preserve pending audit, original backup and both source identities, and refuse blind retries.
- [Actual changes concurrently] → Revalidate the complete snapshot before writing and compare independent readback; the API does not offer an atomic compare-and-set.
