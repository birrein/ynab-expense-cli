# Correct Historical Transfer Origin Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute each checked task with verification.

**Goal:** Correct a bank-evidenced historical own-account transfer source without duplicating the pair.

**Architecture:** An isolated adapter operation validates exact snapshots, unique evidence and three accounts; one API update moves the reciprocal source leg. A pending audit before mutation, backup and independent full-budget verification provide recovery and protect unrelated data.

**Tech Stack:** Node 22.20.0, official Actual API, node:test, OpenSpec.

**Spec:** `openspec/changes/correct-historical-transfer-origin/specs/actual-historical-transfer-origin/spec.md`

## Global Constraints

- No direct SQLite edits; require an exclusive run lease, backup and a complete unrelated-state readback.
- Keep the original IDs, dates, amounts, notes, cleared status and destination account. Never retry an incomplete audit automatically.
- Review both account statements and receipt and establish the destination account alias independently; document any remaining uncertainty.

## Review Focus

- Duplicate or stale pair, or receipt already owned: classifier refuses.
- Missing or identical evidence and ambiguous account payees: classifier refuses.
- Pending prior write or partial result: classifier refuses before mutation.
- Auto-created duplicate counterpart or changed unrelated data: full snapshot test fails.
- Completed identical retry: no additional backup or write.

## Tasks

- [ ] Write focused failing `scripts/actual-transfer-origin.test.mjs` before implementation and run it.
- [ ] Implement `scripts/actual-transfer-origin.mjs`, add dispatch in `scripts/actual-daily.mjs`, then run the focused tests.
- [ ] Validate actual reciprocal behavior on a private offline copy and exercise pending and completed retry handling.
- [ ] Update the runbook and OpenSpec checkboxes, then run the entire Node and Go suites and strict spec validation.
- [ ] Use the exact evidenced candidate for plan/apply and independent readback; update vault evidence and archive the spec only after all tasks are true.
