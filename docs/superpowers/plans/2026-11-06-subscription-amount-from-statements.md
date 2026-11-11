# Subscription Amount from Statements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct an exact legacy recurring subscription amount backed by two statements and a service notice.

**Architecture:** Add an exclusive evidence mode to the existing amount-correction classifier; retain the existing audited executor, backup, readback and retry. Operator inspects the statements and notice before using it.

**Tech Stack:** Node 22, node:test, Actual adapter, OpenSpec.

**Spec:** `openspec/changes/correct-subscription-amount-from-statements/specs/actual-historical-expense-amount/spec.md`.

## Task 1: bounded subscription evidence

- [ ] Add tests to `scripts/actual-historical-amount.test.mjs` for a valid previous same-day transaction, two distinct statement IDs, service notice and small correction; reject mode mixing, bad IDs, changed previous transaction, account/payee/category/note or date differences, bounds and non-CLP.
- [ ] Run tests and observe the new positive case fail before implementation.
- [ ] Implement `subscriptionEvidence` validation in `scripts/actual-historical-amount.mjs`, retaining all other modes and executor guarantees.
- [ ] Verify positive/negative tests, backup/write/readback and retry.

## Task 2: documentation and completion

- [ ] Document the evidence mode and its limitations in `docs/actual-gmail-runbook.md`.
- [ ] Run all Node tests and strict OpenSpec validation; mark completed tasks, sync and archive the spec.

## Review Focus

- Service notice is independent context, not a receipt; operator must inspect it and both statements.
- Full previous snapshot and same account, merchant, category, date pattern and notes are mandatory.
- Mixed modes, same statement, deltas over CLP 100 or 5%, concurrent changes and unaudited retries fail closed.
- Preserve ID, category, cleared flag, other records and audit behavior.
