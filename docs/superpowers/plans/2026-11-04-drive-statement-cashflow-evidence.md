# Drive Statement Cashflow Evidence Implementation Plan

> Execute this plan locally in this session, preserving all unrelated work.

**Goal:** Register bank-statement-backed cashflows without inventing Gmail evidence.

**Architecture:** Extend `classifyCashflow(c,s)` and `cashflow(c,commit,ctx)` in `scripts/actual-cashflow.mjs`. `sourceIds` remains an array of Gmail IDs; optional `driveFileIds` contains opaque Drive IDs. Require at least one real source, render canonical Drive links, persist them in the existing audit, and preserve all existing safeguards.

**Tech Stack:** Node 22.20.0, node:test, official Actual API, Go CLI.

**Spec:** `openspec/changes/add-drive-statement-cashflow-evidence/design.md`.

## Global Constraints
- Existing Gmail-only notes, source IDs, idempotency and transfer validation remain unchanged.
- Independently verify statement account, date and amount before plan; never fabricate sources.
- Preserve lease, backup, duplicate checks, sync and full independent readback.

## Review Focus
- Drive-only evidence requires nonempty valid identifiers and a unique bank-row identity.
- Gmail and Drive references preserve canonical links without accepting arbitrary URLs.
- Duplicate identifiers and malformed arrays cause review, never a write.
- Existing Gmail candidates and already-written notes continue to be idempotent.
- A shared PDF may substantiate distinct rows only if each has its own bank source ID and no conflict.

## Task 1: Evidence contract and audit

**Files:** `scripts/actual-cashflow.mjs`, `scripts/actual-cashflow.test.mjs`.

- [ ] Add tests asserting Drive-only and mixed candidates classify as create, missing/invalid/repeated Drive IDs classify as review, and Gmail-only classification remains unchanged.
- [ ] Run `node --test scripts/actual-cashflow.test.mjs` and observe the expected failures.
- [ ] Implement the contract, canonical note links and `driveFileIds` in audit; preserve Gmail-only note bytes.
- [ ] Verify tests and an isolated actual API write/readback including idempotency.

## Task 2: Documentation and validation

**Files:** `docs/actual-gmail-runbook.md`, OpenSpec artifacts.

- [ ] Document independent Drive evidence validation and user-visible source links.
- [ ] Run all Node tests and Go tests, validate OpenSpec, mark tasks and archive the completed change.
