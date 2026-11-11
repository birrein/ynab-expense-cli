# Distinguish Verified Line Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permit one separately evidenced line payment whose only nearby same-amount match is an earlier verified payment.

**Architecture:** Extend cashflow classification with exact previous reciprocal snapshots and verified prior ledger state; preserve existing executor, backup, readback and retries.

**Tech Stack:** Node 22, node:test, Actual adapter, OpenSpec.

**Spec:** `openspec/changes/distinguish-verified-line-payments/specs/actual-confirmed-cashflows/spec.md`.

## Task 1: Implement evidence checks

- [x] Add failing tests for the valid case, stale snapshots, ledger/source/date/account mismatch and additional duplicate candidates.
- [x] Observe the expected positive test failure, then implement the exclusive mode and audited result.
- [x] Verify backup, readback, prior pair preservation and idempotent retry.

## Task 2: Finish

- [x] Document operator evidence obligations in the runbook.
- [x] Run the Node suite, strict validation and archive the complete change.

## Review Focus

- The operator must inspect the two bank rows; file IDs and descriptors alone are not proof.
- The prior pair and ledger must match exactly and be independently verified.
- Every possible duplicate is covered and prior sources remain untouched.
