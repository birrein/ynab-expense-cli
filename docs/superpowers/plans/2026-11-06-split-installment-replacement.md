# Split Installment Replacement Implementation Plan

> **For agentic workers:** Implement the OpenSpec tasks in order, using tests before implementation.

**Goal:** Replace a documented historical split total with its full billed series while preserving line totals and financial invariants.

**Architecture:** A separate adapter module validates a complete candidate, a proportional line allocation matrix and immutable snapshot before writes. It records pending audit and backup before updating the original first split, creates the remaining splits, synchronizes, and checks an independent complete budget snapshot. Offline API-copy validation precedes any live application.

**Tech Stack:** Node 22.20.0, existing Actual API runtime, node:test, OpenSpec.

## Files and tasks

1. `scripts/actual-split-installment-replacement.test.mjs`: create realistic parent/children and series fixtures, test positive preview, mismatched sums, rounding, duplicates, ownership, exact retry and injected failure; run and observe failure first.
2. `scripts/actual-split-installment-replacement.mjs`: implement candidate validation, exact snapshot checks, backup/pending audit, first split update, remaining split creation and complete independent verification. Re-run targeted tests.
3. Use a private temporary directory and an offline synthetic Actual budget matching the target split to exercise the replacement and delete the isolated copy. An imported existing budget could not be reopened offline because the API attempted to sync to an absent server; document that the synthetic readback uses one process and never present it as an independent server readback. Fail closed if split semantics diverge.
4. Add dispatcher in `scripts/actual-daily.mjs` and operator instructions in `docs/actual-gmail-runbook.md`; run `node --test scripts/*.test.mjs`, `go test ./...` and strict OpenSpec validation. Archive only after tasks and specs are complete.
