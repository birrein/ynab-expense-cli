# Distinguish Verified Same-Origin Transfers Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Admit one explicitly evidenced verified prior transfer to another destination without weakening duplicate protections.
**Architecture:** Extend the existing same-origin exception with a `priorSource` mode. Validate exact reciprocal snapshots and the registered ledger record, preserving the original source and all existing checks; audit the evidence in the existing ledger field.
**Tech Stack:** Node 22.20.0, node:test, Actual adapter, OpenSpec.
**Spec:** `openspec/changes/distinguish-verified-same-origin-transfers/specs/actual-confirmed-cashflows/spec.md`.

## Global Constraints
- Preserve legacy mode, unrelated data, source identity, lease, backup and independent readback.
- Never assume document IDs verify document content; operator independently inspects both statements.

## Review Focus
- Stale prior pair or broken reciprocity: reject in focused tests.
- Missing or changed prior ledger and evidence: reject in focused tests.
- Reused source or receipt: reject in focused tests.
- Extra nearby conflict or wrong destination: reject in focused tests.
- Retrying a completed operation: verify no duplicate writes.

## Task 1: Test and implement
- [ ] Add positive and fail-closed tests to `scripts/actual-cashflow.test.mjs`; observe failure.
- [ ] Implement narrow prior-source mode in `scripts/actual-cashflow.mjs`; run focused tests and idempotence test.

## Task 2: Verify and operate
- [ ] Update the runbook; run full Node and Go suites and validate OpenSpec.
- [ ] Archive the completed spec, preview the real transfer, commit only when preview and evidence match, then independently verify.
