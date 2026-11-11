# Cleared Installment One-Day Correction Implementation Plan

> **For agentic workers:** Execute the OpenSpec tasks inline, preserving unrelated changes.

**Goal:** Correct a one-day same-month billing date discrepancy on a cleared, unreconciled installment while preserving its cleared flag.

**Architecture:** Require explicit `preserveCleared:true` and a Gmail purchase receipt, enforce a one-day same-month correction, and retain the adapter's existing backup, neighboring-series checks, pending audit and full independent readback.

**Tech Stack:** Node 22.20.0, official Actual API, OpenSpec.

**Spec:** `openspec/changes/correct-cleared-installment-one-day/specs/actual-historical-installment-date/spec.md`.

## Global Constraints

- Never alter reconciled, split, ledger-owned or scheduled transactions; never change cleared state.
- Operator must independently verify the statement, purchase, amount, account and series.
- Preserve unrelated files and do not commit the user's work.

## Review Focus

- A cleared correction without explicit intent or Gmail evidence fails.
- Different month or greater than one day fails.
- Reconciled or noncleared transactions cannot use the explicit cleared path.
- Exact neighboring snapshots and unique source remain mandatory.
- Verified retry does not write again and the cleared flag remains true.

## Tasks

- [x] Add negative and positive tests and observe failure.
- [x] Implement and run focused and regression tests.
- [x] Update the runbook and archive the validated OpenSpec change.
