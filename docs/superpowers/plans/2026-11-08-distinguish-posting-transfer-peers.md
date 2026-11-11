# Distinguish Posting Transfer Peers Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Track tasks in OpenSpec.

**Goal:** Safely adjust one transfer when a separately evidenced same-value transfer to the same destination exists.

**Architecture:** The posting-date classifier checks an optional list of complete reciprocal peer snapshots, distinct source accounts and receipts. Peer destinations must exactly equal the set of colliding rows in the existing date window. Full-state digest and verification preserve peers.

**Tech Stack:** Node 22.20.0, node:test, Go CLI, OpenSpec.

**Spec:** `openspec/changes/distinguish-posting-transfer-peers/specs/actual-historical-transfer-date/spec.md`.

## Global Constraints
No fuzzy match, altered sources, unlisted peers, extra declared peers, or changed peer transactions. Independent receipt and statement inspection remains an operator obligation.

## Review Focus
- Reject undeclared same amount, same destination collisions.
- Reject incomplete, stale, nonreciprocal, same-source, wrong-amount or unlisted peer pairs.
- Distinct valid receipt and explanatory evidence required for each peer.
- Preserve completed-audit and prior-audit verification and fail on changed peer.
- Interrupted operations keep pending intent and do not modify peer.

## Steps
1. Add failing classifier and integration tests in `scripts/actual-transfer-posting-dates.test.mjs`; run them to observe failures.
2. Implement exact peer coverage in `scripts/actual-transfer-posting-dates.mjs`; retain old behavior with no peers and verify focused tests.
3. Document in runbook; run Node and Go suites; validate, sync and archive the OpenSpec.
4. Independently inspect receipts and both statements; plan and apply only the verified targeted transfer.
