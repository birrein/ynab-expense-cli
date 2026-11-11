# Distinguish Legacy Line Transfers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely post separate statement-verified line draws and payments blocked by one same-amount historical item.

**Architecture:** Extend `classifyCashflow` with an exclusive evidence object for a single exact historical income or exact reciprocal prior transfer, verified against a distinct row and receipt. Keep existing executor, lease, backup and full readback; audit the exception in the cashflow ledger.

**Tech Stack:** Node 22, node:test, Actual adapter, OpenSpec.

**Spec:** `openspec/changes/distinguish-legacy-statement-line-transfers/specs/actual-confirmed-cashflows/spec.md`.

## Task 1: Evidence validation

- [ ] Add failing tests in `scripts/actual-cashflow.test.mjs` for draw and repayment plus incorrect statement, receipt, same date, invalid snapshots, counterpart, amount, directions, extra matches and stale history.
- [ ] Run targeted tests and observe positive cases fail before implementation.
- [ ] Implement exclusive validation and exact match coverage in `scripts/actual-cashflow.mjs`; audit the complete evidence without attaching the prior receipt as a source to the new transfer.
- [ ] Test backup, transfer creation, full independent readback and idempotent source retry.

## Task 2: Documentation and verification

- [ ] Document operator evidence obligations in `docs/actual-gmail-runbook.md`.
- [ ] Run targeted and all Node tests, strict OpenSpec validation and archive after all tasks complete.

## Review Focus

- Bank statement identifiers and receipt identifiers cannot prove content; operator must inspect.
- Both possible signs, directions and line account constraints are mandatory.
- A missing, changed or additional matching record fails closed; linked card counterpart must be reciprocal and exact.
- Keep prior transactions, notes, original sources, balances and all other data unchanged apart from the new transfer pair.
