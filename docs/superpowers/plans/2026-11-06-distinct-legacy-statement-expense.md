# Distinct Legacy Statement Expense Implementation Plan

> **For agentic workers:** Execute OpenSpec tasks inline, preserving unrelated work.

**Goal:** Distinguish a new bank row from a same-amount legacy expense with a verified separate merchant receipt.

**Architecture:** Validate an exact unlinked historical snapshot and its original receipt alongside the independently inspected shared statement. Require one different-date, different-merchant match and retain existing source, lease, backup, revalidation and whole-budget readback safeguards.

**Tech Stack:** Node 22.20.0, Actual official API and OpenSpec.

**Spec:** `openspec/changes/distinguish-statement-expense-legacy/specs/actual-confirmed-cashflows/spec.md`.

## Global Constraints

- Do not attach the matched prior receipt as a source of the new charge.
- Same-date, same-merchant, additional match, changed legacy snapshot or unsupported evidence stays in Review.
- Never alter the matched legacy transaction; preserve unrelated work.

## Review Focus

- Receipt and statement IDs require independent inspection; IDs alone prove nothing.
- New charge retry must not duplicate.
- Missing, malformed or conflicting receipt, statement and descriptors fail closed.
- Existing transaction source identity and category remain unchanged.
- Audit records the exception and statement links.

## Tasks

- [x] Add tests and observe red.
- [x] Implement narrow validation and audit, run tests.
- [x] Document, validate and archive OpenSpec.
