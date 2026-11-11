## Context

The classifier blocks equal-value nearby transactions. The existing verified-statement exception requires multiple prior matches on different dates and an existing target payee; neither fits two same-day statement lines where only one has been recorded.

## Goals / Non-Goals

**Goals:** Admit exactly one same-day conflict when the prior simple transaction and its ledger source are verified against the same statement and the operator has independently inspected distinct merchant rows.

**Non-Goals:** Infer statement contents from IDs or supplied descriptors; support ambiguous merchants, multiple conflicts, identical descriptors, transfer rows, unverified prior records or a same-source retry as a new entry.

## Decisions

Use an explicit `distinctSameDayStatementExpense` field with the shared statement ID, exact prior transaction snapshot, prior descriptor, new descriptor and evidence. The new descriptor equals the candidate payee name, while the previous descriptor is explicitly operator supplied; require distinct normalized descriptors and prior payee name. The prior transaction must be a verified statement-backed cashflow with exact ledger identity and source and both source and statement links in its notes. The candidate date, amount and account match the prior; the full duplicate match set must contain exactly the prior ID. A target payee may be safely created through the existing payee creation path. This narrower path is preferable to weakening the existing exception.

Commit retains the unchanged existing backup, lease, full-state revalidation, payee creation, source idempotency, sync and independent readback. Persist the exception in the cashflow audit.

## Risks / Trade-offs

- A distinct label cannot prove that two bank rows are separate: the operator must inspect the full statement and refunds before plan.
- A process failure after writing remains subject to the existing source-first recovery rule; no new source may be fabricated.
