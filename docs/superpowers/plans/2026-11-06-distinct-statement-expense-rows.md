# Distinct Statement Expense Rows Implementation Plan

> **For agentic workers:** Use the existing OpenSpec tasks for execution and verification. Work inline as requested by the user; retain all unrelated changes.

**Goal:** Safely record separate same-merchant, same-amount expenses shown on different dates in one verified statement.

**Architecture:** Extend cashflow classification with a single explicit evidence object. The candidate names the statement and exact snapshots for every nearby match, and the operator inspects every claimed row. Existing lease, backup, revalidation and readback remain authoritative.

**Tech Stack:** Node 22.20.0, Actual official API, OpenSpec.

**Spec:** `openspec/changes/allow-distinct-statement-expense-rows/specs/actual-confirmed-cashflows/spec.md`.

## Global Constraints

- No duplicate source, same-date ambiguity, missing competing match, altered existing transaction or bypass of four-day matching.
- Do not infer statement contents from a file ID; operator verifies document, account and each row.
- Preserve dirty unrelated files and existing workflow; do not commit user changes.

## Review Focus

- Additional nearby match remains Review; test in cashflow classification.
- Same-date or altered snapshot remains Review; test both cases.
- Exact retry after a successful write never duplicates; test end-to-end harness.
- Unchanged transaction category, account, source and payee are independently verified by the existing write workflow.
- Evidence must survive in the audit and candidate backup; validate before archival.

## Tasks

- [x] Add focused red tests and confirm they fail on the missing capability.
- [x] Implement the minimum classification and audit fields.
- [x] Verify focused and policy tests, including write/retry, and update runbook.
- [x] Validate and archive OpenSpec before the live run.
