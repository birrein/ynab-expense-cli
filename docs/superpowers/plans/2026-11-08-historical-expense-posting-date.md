# Historical Expense Posting Date Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and track tasks in OpenSpec.

**Goal:** Correct a proven historical expense's posting date without changing any other field or creating a new expense.

**Architecture:** Extend the existing audited statement-date module with a mutually exclusive negative expense mode and a separate audit namespace; reuse exact full-state hash, backup and independent readback. Add the new namespace to the global pending guard.

**Tech Stack:** Node 22.20.0, node:test, Go CLI, OpenSpec.

**Spec:** `openspec/changes/correct-historical-expense-posting-date/specs/actual-historical-expense-statement-date/spec.md`.

## Global Constraints
Require single covering statement, distinct receipt, categorized simple historical transaction and unique payer/recipient and amount; no ledger-owned, imported, reconciled, split, scheduled or transfer rows.

## Review Focus
- Old/new and receipt dates must be valid, bounded and covered by one statement.
- Receipt may precede the old date by at most one day, never follow it.
- No same-amount nearby candidate or previously used source may pass.
- Income mode and its existing audits must not change.
- Expense audit pending blocks all financial writes; completed retry is read-only.

## Steps
1. Add failing tests to `scripts/actual-historical-income-date.test.mjs`, including negative amount, receipt earlier, duplicate, ownership, pending and read-only retry.
2. Implement explicit expense mode, separate audit and dispatch, and pending guard; run focused and offline tests.
3. Document usage, run full suites, validate and archive spec, then plan and apply only uniquely evidenced transactions.
