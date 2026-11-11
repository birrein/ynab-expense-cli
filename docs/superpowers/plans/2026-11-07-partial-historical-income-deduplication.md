# Partial historical income deduplication implementation plan

> **For agentic workers:** Implement under the OpenSpec change `adjust-overlapping-historical-income`. Preserve unrelated work. Use Node 22.20.0 via nvm.

**Goal:** Correct only the verified overlapping portion of a historical positive aggregate, preserving individual bank-verified income and the residual.

**Architecture:** Add `scripts/actual-partial-income-dedup.mjs` and tests using the dependency-injected snapshot/connect/backup/audit patterns of the adapter. Dispatch from `actual-daily.mjs`, guard pending protected targets/sources and document in the runbook. Plan hashes bind all evidence and snapshots. Full-budget readback proves only one amount changed.

**Tech Stack:** Node 22, node:test, official Actual API, OpenSpec.

1. Write failing tests for valid exact snapshots/ledger-backed components, arithmetic, ownership, stale state, hash and intent recovery. Run them to establish red.
2. Implement validation and execution: plan, hash, owned lease, backup, durable pending intent, pre-write equality, amount-only update, independent full readback and audit. Reject pending intents. Test expected and adverse paths.
3. Wire candidate dispatch and protect pending intent against other operations. Add runbook. Run targeted tests, all Node tests, Go suite and independent review; repair findings.
4. Validate/archive OpenSpec; verify provider statements and snapshots, plan/apply with lease, inspect independent readback and document new cut balances and remaining ambiguities. Finish without moving window markers.
