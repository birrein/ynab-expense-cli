# Supersede Transfer Audit Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute these steps. Track OpenSpec tasks in its tasks.md.

**Goal:** Safely adjust one bank posting date after a prior audited operation-date correction without invalidating either audit.

**Architecture:** Extend the existing posting-date classifier with explicit `priorTransferDateCorrection` linking and full previous-result equality. Extend the old classifier's completed retry path to accept only the exact complete linked successor and its expected final legs; all existing backup, lease, hash, pending and independent-read guards remain.

**Tech Stack:** Node 22.20.0, node:test, Go CLI, OpenSpec.

**Spec:** `openspec/changes/supersede-audited-transfer-posting-date/specs/actual-historical-transfer-date/spec.md`.

## Global Constraints

No source changes, new transaction, manual state edits, or relaxed matching. Preserve the previous audit byte-for-byte. Treat partial and conflicting histories as errors.

## Review Focus

- Unlinked prior audit: posting classifier rejects without explicit linkage.
- Prior pending or missing: reject before plan and write.
- A forged successor: exact full previous outcome, currency, IDs, fields and explicit flag required.
- Successor pending: old retry fails and global write guard continues blocking.
- Existing unrelated pair and completed retry: original behavior remains unchanged.

## Tasks

1. Add tests to the existing transfer posting and transfer date test files that fail for a valid linked successor, reject unlinked/missing/pending/mismatched history, and require the old repeat to accept only the complete exact successor.
2. Implement minimal classification changes in `scripts/actual-transfer-posting-dates.mjs` and `scripts/actual-transfer-date.mjs`; rerun focused tests including interruption and read-only retries.
3. Add runbook guidance, run Node and Go suites, validate and archive OpenSpec, then use the supported workflow only on independently evidenced transactions.
