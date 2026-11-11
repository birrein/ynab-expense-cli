# Income Date with One Covering Statement Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and track tasks in OpenSpec.

**Goal:** Correct evidenced historical income dates where one statement covers both dates and a distinct bank receipt identifies the transaction.

**Architecture:** Add an explicit `singleStatementEvidence` candidate object with receipt and date bounds to the existing income-date classifier; preserve all plan hash, snapshot, lock, backup and independent readback semantics.

**Tech Stack:** Node 22.20.0, node:test, Go CLI, OpenSpec.

**Spec:** `openspec/changes/correct-income-with-single-statement/specs/actual-historical-income-statement-date/spec.md`.

## Global Constraints
Never fabricate statement IDs, infer from amount alone, change a category, or bypass ownership and duplicate protections. The operator reads the statement and receipt.

## Review Focus
- Both dates covered by one actual statement and receipt date equals old date.
- Require identical statement IDs only for explicit mode and distinct IDs otherwise.
- Reject malformed or already used receipt, conflicting payer, range, snapshot and duplicate.
- Exact repeated completed audit verifies without rewriting; interrupted audit blocks writes.
- Other historical income corrections retain their prior behavior.

## Steps
1. Add failing positive and negative evidence tests and integration retry/interruption cases in `scripts/actual-historical-income-date.test.mjs`.
2. Implement strict alternative mode in `scripts/actual-historical-income-date.mjs`, rerun targeted tests.
3. Document, run full suites, validate and archive OpenSpec; apply only independently verified examples.
