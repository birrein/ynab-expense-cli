# Evidenced Transfer Date Correction Implementation Plan

> Execute inline while preserving unrelated user work.

**Goal:** Correct both legs of a verified historical transfer without changing their identities or balances.

**Architecture:** A dedicated operation validates exact snapshots and evidence, records a pending audit, updates both dates, then verifies a fresh full download.

**Tech Stack:** Node 22.20.0, Actual API, node:test, Go, OpenSpec.

**Spec:** `openspec/changes/correct-evidenced-historical-transfer-date/specs/actual-historical-transfer-date/spec.md`

## Global Constraints

- Only one-day same-month corrections to unowned, unreconciled linked pairs.
- Preserve cleared flags and all fields except the date.

## Review Focus

- A competing equal-amount transfer must block the change.
- Either stale snapshot must block all writes.
- Cleared states must remain distinct and unchanged.
- An interrupted operation must block retry.
- A completed retry must verify both legs without writing.

## Task 1: Guarded correction

**Files:** Create `scripts/actual-transfer-date.mjs` and `scripts/actual-transfer-date.test.mjs`; modify `scripts/actual-daily.mjs` and `docs/actual-gmail-runbook.md`.

**Interfaces:** `classifyTransferDate(candidate, snapshot, ledger)` and `correctTransferDate(candidate, commit, dependencies)`.

- [ ] Write tests for every review focus case and observe `node --test scripts/actual-transfer-date.test.mjs` fail for the absent implementation.
- [ ] Implement guarded correction, independent readback and routing; run the focused tests.
- [ ] Run all Node and Go tests and strict OpenSpec validation; document and archive the change.
