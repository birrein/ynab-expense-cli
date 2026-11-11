# Evidenced Aggregate Transfer Replacement Implementation Plan

> Execute the tasks inline in this working tree; preserve unrelated user work.

**Goal:** Replace one grouped legacy transfer with individually evidenced pairs without changing balances.

**Architecture:** A dedicated adapter operation validates exact snapshots, sources and conflicts; a pending audit precedes official API writes and a fresh download verifies all effects.

**Tech Stack:** Node 22.20.0, official Actual API, node:test, Go CLI, OpenSpec.

**Spec:** `openspec/changes/replace-evidenced-aggregate-transfers/specs/actual-historical-aggregate-transfer-replacement/spec.md`

## Global Constraints

- Only active same-currency accounts; enforce lease, backup and independent verification.
- Never automatically repeat a partial mutation or change a source to bypass duplication.

## Review Focus

- Matching component amounts on the same day must remain distinct with unique receipts.
- Invalid snapshots and additional nearby matches must fail before writing.
- A pending audit must prevent retry after any interrupted write.
- Completed retry must check the exact existing pairs and avoid another write.
- Every unrelated transaction and account balance must remain unchanged.

## Task 1: Guarded replacement

**Files:** Create `scripts/actual-aggregate-replacement.mjs` and `scripts/actual-aggregate-replacement.test.mjs`; modify `scripts/actual-daily.mjs` and `docs/actual-gmail-runbook.md`.

**Interfaces:** `classifyAggregateReplacement(candidate, snapshot, ledger)` and `replaceAggregateTransfer(candidate, commit, dependencies)`.

- [ ] Write tests proving the five review cases and that an exact two-component candidate plans successfully.
- [ ] Run `node --test scripts/actual-aggregate-replacement.test.mjs`; expect missing implementation failure.
- [ ] Implement validation, pending audit, official API mutation, independent readback and routing.
- [ ] Run the focused test, `node --test scripts/*.test.mjs`, `go test ./...` and `openspec validate replace-evidenced-aggregate-transfers --strict`; expect all to pass.
- [ ] Document the guarded workflow and archive the completed OpenSpec change.
