# Same-day statement expenses implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Allow an independently verified second same-day, equal-value expense from a distinct merchant without bypassing duplicate checks.

**Architecture:** Add one opt-in classifier branch to `scripts/actual-cashflow.mjs`, requiring the exact sole prior match and its existing verified ledger record. Retain the common backup, source-idempotency, lease and independent readback pipeline.

**Tech Stack:** Node 22.20.0, Actual official API, node:test, OpenSpec.

**Spec:** `openspec/changes/archive/2026-11-06-distinguish-same-day-statement-expenses/specs/`.

## Global Constraints

Operator reviews the actual full statement and all matching entries; no document ID proves contents. Uncertainty stays Review. Preserve unrelated work and do not commit financial data.

## Review Focus

- Stale or missing prior transaction/ledger, invalid source or statement must fail closed.
- Identical merchants, dates that differ, unsupported type and mixed exceptions must fail closed.
- A second nearby conflict must fail closed rather than be ignored.
- Missing category requires a reason and retains Review.
- An unchanged retry verifies the original source without another transaction or payee.

### Task 1: Test and implement the classifier

**Files:** Modify `scripts/actual-cashflow.mjs`; test `scripts/actual-cashflow.test.mjs`.

- [x] Add failing tests for success and each review focus, then run the focused Node test suite.
- [x] Implement `distinctSameDayStatementExpense` and its audit with exact conflict coverage; rerun focused tests.
- [x] Add a commit and idempotent retry test and confirm complete Node and Go suites.

### Task 2: Document and perform the evidenced operation

**Files:** Modify `docs/actual-gmail-runbook.md` and the change tasks.

- [x] Document the required independently verified statement, distinct descriptors, exact snapshot, ledger and fail-closed behavior.
- [x] Validate and archive the OpenSpec change; inspect the statement and prepare a private candidate.
- [x] Use status, begin-run, plan, apply with lease, independently verify, document and finish without advancing windows.
