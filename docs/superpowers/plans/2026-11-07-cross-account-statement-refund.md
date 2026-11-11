# Cross-Account Statement Refund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Safely record a merchant refund backed by a destination account statement when its original purchase belongs to a different account.

**Architecture:** A dedicated operation uses an exact verified Gmail-owned purchase and record, separate merchant email and destination statement, and a stable bank line source. It preserves the original, applies the existing lease and outer lock, and independently verifies a single credit in the original category with a durable audit.

**Tech Stack:** Node 22.20.0, official Actual API, node:test, OpenSpec.

**Spec:** `openspec/changes/support-cross-account-statement-refunds/specs/actual-cross-account-statement-refunds/spec.md`.

## Tasks

- [ ] In `scripts/actual-cross-account-statement-refund.test.mjs`, first test eligibility and failure paths: wrong/closed account, missing merchant or statement evidence, uncategorized or stale purchase/record, duplicate source or nearby credit, prior refunds across accounts, over-refund and pending audit. Confirm the tests fail because the new module is absent.
- [ ] Implement classification in `scripts/actual-cross-account-statement-refund.mjs`, requiring exact candidate fields, a verified `records[purchaseSourceId]`, matching Gmail import, valid source and distinct active accounts, unique merchant and bank sources, original category/payee, independently reviewed evidence, and cumulative linked-refund checks. Test classification.
- [ ] Add and run tests using an in-memory fake Actual API for one write, unchanged original and unrelated state, exact balance effects, independent reconnect, idempotent retry, interrupted pending audit, and rejection on concurrent changes. Implement safe commit with backup, pre-write snapshot equality, durable pending audit and full post-write verification.
- [ ] Route only the explicitly named candidate in `scripts/actual-daily.mjs`; document candidate schema and mandatory independent source inspection in `docs/actual-gmail-runbook.md`.
- [ ] Run targeted Node test, all Node tests and Go tests under Node 22.20.0; validate OpenSpec strictly and archive after completed tasks. Do not write any user financial data until its category and evidence are resolved and the plan matches.

## Review Focus

- A Gmail purchase record must match the snapshot and category exactly; merchant and statement references cannot reuse the purchase source.
- Nearby credits and refunds linked to the purchase across all accounts must block or count against the original.
- The destination alone changes balance; independent verification covers every prior transaction and nontransaction state.
- A pending intent never causes a blind retry, even if the write outcome is uncertain.
