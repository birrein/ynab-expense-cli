# Owned Transfer Posting Date Implementation Plan

**Goal:** Correct one independently evidenced source-owned transfer posting date while retaining its original provenance and retry safety.

**Architecture:** Extend the existing posting-date module with a separately guarded classifier and audited operation. Link the complete original cashflow candidate, ledger, and reciprocal snapshots to the audit; recognize exact original retries through that complete audit only.

**Tech Stack:** Node 22.20.0, official Actual API, node:test, OpenSpec.

**Spec:** `openspec/changes/correct-owned-transfer-posting-date/`.

## Global Constraints

Never change source IDs, the original cashflow record, balances, other transaction fields or dashboards. Require distinct verified statements, a receipt, lease, lock, backup, stable plan hash, pending audit and independent full readback. Reject ambiguous matches and globally block writes after interruption.

## Review Focus

- Missing legacy status is acceptable only with exact existing verified backup and timestamp; other status values fail closed.
- Linked original candidate, snapshots and source links must be exact; changed candidates or duplicate audit chains are rejected.
- Same-value collisions near either date must stop mutation.
- A failed update or readback must leave a pending audit that blocks all financial routes.
- Completed exact retries must verify without writing either financial data or the original ledger.

## Tasks

1. Write failing classifier tests in `scripts/actual-owned-transfer-posting-date.test.mjs`; verify they fail for missing behavior. Implement `classifyOwnedPostingDate` in `scripts/actual-transfer-posting-dates.mjs` and verify exact and invalid fixtures.
2. Add failing execution tests for backup, intent ordering, interrupted write, independent readback, stale hash and retry; implement audited operation in the same module and route it via `scripts/actual-daily.mjs`.
3. Add pending intent to the global mutation guard and exercise it through offline CLI tests. Add tests and narrowly scoped support for read-only exact original cashflow retries in `scripts/actual-cashflow.mjs`.
4. Run focused and complete test suites, update `docs/actual-gmail-runbook.md`, independently inspect the bank statements and original backup, preview/apply the precise candidate, and document the verified outcome. Validate and archive OpenSpec.
