# Distinguish Same-Origin Transfers Implementation Plan

> Implement directly in this session, one test-driven task at a time.

**Goal:** Distinguish two bank-evidenced same-date and same-amount transfers from one card to different owned accounts.
**Architecture:** Extend `classifyCashflow` with an exclusive fully-specified match exception; retain it in cashflow audit and preserve the existing safe apply path. Check complete conflict coverage.
**Tech Stack:** Node 22.20.0, node:test, Actual official API, OpenSpec.
**Spec:** `openspec/changes/distinguish-same-origin-transfers/specs/actual-confirmed-cashflows/spec.md`.

## Global Constraints

Never alter a prior pair, fabricated source, account, budget or backup semantics. Inspect source documents independently; object assertions do not prove document contents.

## Review Focus

Stale snapshots, reciprocal payee or link changes, extra conflicts, same destination and absent distinct evidence must return review. Exact retry must be idempotent. A new result must retain audit evidence and leave prior legs unchanged.

## Task 1

- [ ] Add a fixture for exact prior pair and new distinct statement/report, with rejection mutations covering each review concern and a mock commit checking backup/readback/audit/retry.
- [ ] Run `node --test scripts/actual-cashflow.test.mjs` and verify failure arises from unsupported candidate.
- [ ] Update classifier allowlist, exclusive evidence validation, complete conflict set and audit.
- [ ] Run targeted tests then `node --test scripts/*.test.mjs`; document runbook and archive validated spec.
