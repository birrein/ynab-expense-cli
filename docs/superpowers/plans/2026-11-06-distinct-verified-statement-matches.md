# Distinct Verified Statement Matches Implementation Plan

> **For agentic workers:** Use `openspec-apply-change`, execute sequentially, and maintain existing user changes.

**Goal:** Safely recognize a new statement purchase when every nearby equal-amount match is already verified from another row of the same statement.

**Architecture:** Add a separate classifier mode and pass the authoritative ledger to classification. Require exact snapshots and complete equality of duplicate IDs, independently verified ledger entries, distinct merchants/dates, canonical statement links and a stable bank source for each prior movement. Retain backup, prewrite revalidation, independent readback and idempotent audit.

**Tech Stack:** Node 22.20.0, node:test, Actual API, OpenSpec.

**Spec:** `openspec/changes/distinct-verified-statement-matches/specs/actual-confirmed-cashflows/spec.md`.

## Constraints and review focus

- Operators must read the statement; supplied identifiers cannot prove it.
- Reject missing or stale ledger and snapshots, unaccounted matches, duplicate dates, merchants or sources, transfer or split entries, inconsistent notes, and mixed exception flags.
- Unknown category stays in Review, existing purchases remain unchanged, source identity is stable, and exact retry is idempotent.

## Steps

1. Add failing behavior tests in `scripts/actual-cashflow.test.mjs` for two prior verified statement expenses and negative cases; run them to confirm failure.
2. Implement the opt-in classifier and separate audit in `scripts/actual-cashflow.mjs`; test the full write and retry using the existing harness.
3. Document in `docs/actual-gmail-runbook.md`, run the full adapter tests and strict OpenSpec validation, sync and archive the spec.
4. Verify statement rows and existing ledger independently, create a private candidate, run plan and, only when it agrees, apply under an owned lease with backup and independent readback; document and close without advancing daily windows.
