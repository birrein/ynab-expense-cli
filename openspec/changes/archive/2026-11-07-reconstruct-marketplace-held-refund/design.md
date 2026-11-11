## Context

The independently downloaded release report provides dated gross available-balance entries, including a sale credit, shipping, reserved funds, reserve release and individual mediation/refund entries. Two fees were already recorded with their own sources. The monthly ending balance alone hides missing intermediate postings.

## Goals / Non-Goals

**Goals:** Preserve dated available balances, zero net income for the cancelled sale, and a traceable temporary restriction without duplicating existing costs.

**Non-Goals:** Infer a category for fees, change historical fees, rebook transfers, invent a bank adjustment, or assume a reconciled bank balance solely from a matching month end.

## Decisions

- Use a dedicated, zero-opening, on-budget holding account and reciprocal native transfers; close it only after verified zero. This explicitly distinguishes unavailable retained funds while avoiding fake income or spending. A synthetic pending category or arbitrary balance adjustment would distort reports and obscure the hold.
- Post the sale release and each separately sourced claim settlement component under a dedicated category describing canceled-sale settlement, in the existing Income group. Their signed sum must be zero. Current summary cards filter amounts by sign rather than summing net, so the category must be excluded from each affected income, expense, cash-flow and spending widget before posting. A general income category would overstate positive income and gross spending in historical analysis. A single inferred net refund would lose the provider's component dates and identities.
- Require exact snapshots of the already verified fees and of all expected nearby relevant records, complete provider evidence references, and operator-confirmed daily statement cut balances. Sources and same-amount nearby entries are checked across accounts and the ledger. A preview hash binds the full candidate, budget and complete current dashboard definitions. The operation adds only an AND category-exclusion filter to applicable widgets; it fails on unknown filter composition and independently verifies all changes. Other reports must be inspected separately before using them for historical analysis.
- Persist a pending audit before account creation or transactions, recheck the lease, preserve a complete pre-write backup, and independently download and validate transaction fields, reciprocal pairs, daily balances and every unrelated data record. A partial result requires inspection, not a repeated write. Completed retries verify all identities and cannot create anything.
- Account closure is a separate last step after fresh verification of zero, followed by another independent verification. Closing does not erase history or suppress audit.

## Risks / Trade-offs

- [Temporary availability may be misinterpreted] The held account's explicit name and closure retain the historical distinction; it is not a current active account after successful verification.
- [Partial multi-write] The pending audit prevents an unsafe retry; preserve IDs, sources and backup for recovery.
- [Provider rows can double count reserve mechanics] Accept only operator-selected economic entries plus the two native hold transfers, requiring their aggregates to reconcile independently verified daily cuts. Exclude provider's immediate reserve/release pairs that net to zero.
- [Sign-based widgets overstate both gross income and expenses] Use a specific canceled-sale category and independently verify category exclusions on all affected existing widgets; flag other reports for review. The category represents a real documented accounting treatment, not a placeholder for unknown spending.

## Migration Plan

Deploy as an opt-in, evidence-bound adapter operation after offline and integration tests. Apply only after source review and preview. On interruption retain the pending audit and backup; inspect state before any manual recovery. Do not alter existing flows.
