# RappiCard Cross-Currency Debt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Preserve both issuer provenance and dual-budget safeguards for a statement-backed RappiCard debt conversion.

**Architecture:** Extend `scripts/actual-cross-currency-debt.mjs` with one explicit issuer option and exact account/source identity checks. Existing audit, backup, idempotency and independent verification remain the sole write path.

**Tech Stack:** Node 22.20.0, official Actual API, node:test, OpenSpec.

- [ ] Add focused acceptance and negative tests to `scripts/actual-cross-currency-debt.test.mjs`; run to see the new acceptance test fail.
- [ ] Implement strict RappiCard reference, account-name and bank-source validation; preserve BCH behavior.
- [ ] Run targeted unit and isolated official API tests, update `docs/actual-gmail-runbook.md`, validate and sync the capability spec, and archive the completed change.
