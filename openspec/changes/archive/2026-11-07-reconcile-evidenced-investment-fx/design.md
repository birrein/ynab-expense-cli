## Context

Actual's CLP and USD budgets have different sync IDs and no native cross-budget transfers. The existing debt conversion is deliberately restricted to CLP out / USD in and categories named for that direction. Investment conversion has the reverse direction and must not reuse misleading category names. Statements show USD 216.63 out of Racional Stocks and CLP 200,362 into its Portafolios cash on 8 July 2026; the bank independently shows a subsequent CLP 200,362 withdrawal. The Portafolios USD statement also shows matching USD 216.63 in and out with zero residual during the transfer, so the proposed two-budget pair is a composite economic view rather than a separate USD Portafolios account. A separate verified Portafolios withdrawal and its documented one-peso residual are already recorded.

## Goals / Non-Goals

**Goals:** Represent the exact evidenced cash movements and the bank receipt without counting either conversion leg as earnings or consumption in the identified widgets; support safe full readback and recovery.

**Non-Goals:** Reconstruct historical investments, acquisition costs or all assets; automatically discover conversions; calculate rates; claim all reports are filtered; modify the unrelated debt-specific command.

## Decisions

- The USD side needs a correctly named expenditure category `Transferencias entre monedas / Salida USD`; the CLP side needs an income category `Transferencias entre monedas / Entrada CLP`. Existing categories of the reverse direction cannot be repurposed without making reports and meaning misleading. Create missing categories only through an auditable, backed-up, independently verified operation; refuse name collisions and wrong group/type.
- Before any opening or conversion write, examine actual dashboards for both affected budgets and make the narrowly needed category exclusions to the relevant income/expense widgets, preserving unrelated existing filters. Verify persistence and document the scope; do not promise global exclusion. Opening balances must also be excluded from the relevant USD income widget. USD 216.63 is an independently supported *cash checkpoint after sales*, not a valuation of the entire portfolio or a record of the previous sales.
- Record the conversion as separately sourced, explicitly categorized legs with the exact reported USD and CLP amounts and a common reference, using the existing cross-budget safety model. This is a linked audit and notes, not a native Actual transfer. Use no inferred rates. Register the CLP bank withdrawal as a separate native transfer with its own source, duplicate checks and reciprocal readback.
- Use dedicated functions for category creation and conversion; require a lease and lock, exported backups, full revalidation and a pending audit before mutation. Revalidate current snapshots immediately before each budget write; independently read back both whole budgets and preserve all original records and balances except the intended deltas. Completed retries only verify. Pending results block retry pending manual investigation.

## Risks / Trade-offs

- [Cross-budget writes are not atomic] → Back up each, persist pending state before either write, block ambiguous retries and inspect originals and backups before recovery.
- [Report filtering is widget-specific] → Verify named affected widgets and identify unfiltered reports explicitly; do not claim global correctness.
- [Opening after sales omits prior asset history] → Label checkpoint and limitation in notes; never add historical contributions or claim full portfolio reconciliation.
- [Reports use categories as accounting flows] → Do not post until dedicated categories and applicable filters are visible and persisted.

## Migration Plan

Complete evidence and report preflight, test in isolated budgets, create the empty transfer categories, verify report exclusions, create the cash checkpoint, register the exact conversion pair, then the bank transfer. Archive the OpenSpec after verified reconciliation and documentation. For interrupted writes, retain audit and backups and investigate; do not automatically restore or generate new source IDs.

## Report preflight observed 2026-11-07

The CLP Main dashboard `Total Income (YTD)` excludes `Salida CLP` and `Starting Balances` but not a new CLP incoming conversion category. The USD Main dashboard `Total Income (YTD)` excludes `Transferencias entre monedas / Entrada USD` but not `Starting Balances`; its `Total Expenses (YTD)` excludes that same incoming category but no USD outgoing conversion category. Both USD widgets have ordinary on-budget and non-transfer filters. Other averages and reports remain to be inspected. No new category, USD opening or FX leg has been written.

The adapter records the operator's report evidence; it does not read dashboard filters and cannot independently prove this preflight. The operator must verify live widgets before applying the conversion; a text attestation is not a substitute.
