# Evidenced Investment FX Implementation Plan

> **For agentic workers:** Apply the OpenSpec tasks in the current user-authorized worktree. Preserve unrelated changes and follow the user's no-repeat-approval direction where tool policy permits.

**Goal:** Represent exact statement-backed USD-to-CLP investment conversion and the following own-account bank transfer without inflating the inspected income and expense reports.

**Architecture:** Separate category setup and cross-budget conversion operations, both using the existing daily adapter lease, backup and independent verification. A native same-currency transfer remains a separate `cashflow` after both conversion legs exist. A dated USD cash checkpoint does not imply reconstructed assets or sales. No cross-budget native transfer exists.

**Tech Stack:** Node 22.20.0 via nvm, official `@actual-app/api`, node:test, Go CLI, OpenSpec, existing Actual daily ledger and local isolated budget tests.

## Tasks

- [ ] Confirm the relevant USD and CLP widget definitions and direction-specific category group IDs from fresh snapshots. Record current report filters and values before changing anything; identify other affected averages and default reports. Verify the USD and CLP amounts and dates in the original statements and conversion receipt, including the intermediate USD in-and-out, before preparing live candidates.
- [ ] Write negative tests first for category name/type collisions, unsafe duplicate creation, unexpected changes to unrelated records, idempotent completion and interrupted writes. Run them and record the expected failure before implementing a narrowly scoped, lease-and-backup-protected category operation.
- [ ] Implement category setup through `scripts/actual-daily.mjs` dispatch and a dedicated module. Validate existing categories and group types; use official API, pending audit, safe retry and full independent readback. Exercise in an isolated imported budget and re-run focused tests.
- [ ] Write failing tests for USD-out/CLP-in conversion, wrong category direction, mismatched evidence, duplicate sources and nearby transactions, two backups, pending audit and partial-write recovery. Include preservation checks for every unrelated account and transaction. Implement a separate operation using the tested cross-budget debt adapter safety pattern; do not repurpose its categories or change its existing behavior.
- [ ] Run focused tests, isolated official-API readback tests, all Node tests, `go test ./...`, and strict OpenSpec validation. Document candidate schemas, operator evidence obligations, reporting limitations and recovery in the runbook.
- [ ] Apply verified report filters as permitted, verify persistence and unchanged widget values before any real financial writes. Plan/apply category setup, the statement-backed USD cash checkpoint, the FX pair and finally the native CLP bank transfer under an owned lease. Inspect exact sources after errors; never regenerate identifiers to force writes.
- [ ] Verify transaction IDs, both budgets and balance deltas with a fresh readback. Update only the associated Gmail labels, preserving unread/inbox; record both statements, IDs, backup paths, incomplete investment history and widget scope in the monthly note and hub. Close the lease with no daily window advances, validate and archive OpenSpec.
