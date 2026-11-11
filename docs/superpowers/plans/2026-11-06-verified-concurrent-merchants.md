# Verified concurrent merchants implementation plan

> **For agentic workers:** Use superpowers:executing-plans and retain financial evidence checks.

**Goal:** Allow a documented new expense when two previously verified different merchants share an earlier date and amount.

**Architecture:** Narrowly update the existing verified-statement matching mode, retaining full conflict coverage, source uniqueness, audit, backup, lease, sync and independent readback.

**Tech Stack:** Node 22.20.0, Actual API, Go, OpenSpec.

**Spec:** `openspec/changes/archive/2026-11-06-distinguish-verified-concurrent-merchants/specs/` after archive.

## Global Constraints

No forged or reused source; all original transactions remain unchanged. The operator independently inspects statement rows and receipt.

## Review Focus

- Prior sources, descriptors, IDs and snapshots remain unique and verified.
- Candidate date remains distinct from each prior row.
- Every nearby conflict must be explicitly included.
- Unknown payee creation is backed up and verified.
- A repeated source remains idempotent and overlapping Gmail sources are rejected.

### Task 1: Implementation and validation

**Files:** `scripts/actual-cashflow.mjs`, `scripts/actual-cashflow.test.mjs`, `docs/actual-gmail-runbook.md`.

- [ ] Write tests that fail before implementation, including conflict and source protections.
- [ ] Implement minimal condition changes and verify commit/readback/retry.
- [ ] Run Node and Go suites, validate and archive OpenSpec.

### Task 2: Evidence-backed expense

- [ ] Verify both bank rows and the complete two-ticket receipt.
- [ ] With a valid lease, plan and apply the exact candidate only if it passes, verify and document, and finish without advancing windows.
