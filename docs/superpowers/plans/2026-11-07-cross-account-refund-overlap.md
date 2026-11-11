# Cross-account refund overlap implementation plan

**Goal:** Retire one documented gross duplicate while retaining its independently evidenced net expense and preserving the completed migration audit.

**Architecture:** `scripts/actual-cross-account-overlap.mjs` owns exact classification, a digest-bound plan and single-record operation. `scripts/actual-daily.mjs` provides dispatch, owned lease, locking and global pending-write guard. `scripts/actual-partial-account-migration.mjs` recognizes only a precise completed retirement audit on re-verification. Use Node 22.20.0 and the official Actual API.

**Spec:** `openspec/changes/retire-migrated-cross-account-refund-overlap/`.

## Constraints

- Do not touch unrelated budgets, edit SQLite, fabricate sources or store credentials.
- A separate possible refund, differing snapshot, conflicting ledger reference or missing evidence fails closed.
- Preserve all transaction fields except deleting the verified gross; retain the full gross snapshot and original source in the audit.
- Pending intent must block `apply`, `remove --commit` and `adopt-budgets`; an interrupted write requires inspection, not an automatic retry.

## Implementation and verification

1. In `actual-cross-account-overlap.test.mjs`, prove exact pair and migration, category, reference, date, ownership, amount and separate-refund rejections. Run a failing test first for each behavioral extension, then implement and rerun.
2. Test pending intent blocks all financial mutations before connecting, then implement dispatch and shared guard. Verify that the original migration's guard remains effective.
3. Test official-API deletion and independent reconnect using controlled fixtures; verify the complete budget, including dashboards, unchanged except gross and its account balance. Persist intent before delete, complete audit after readback, and implement read-only exact retry.
4. Test migration retry with exact completed linked retirement, and rejection of pending, missing, duplicated, changed gross or net evidence; implement without altering original audit.
5. Update runbook; run all Node tests, Go tests and strict OpenSpec validation. Use a private offline copy for realistic integration before any live apply.
6. Re-read complete statement and three messages; verify refund absent in all relevant live transactions, build exact candidate in private storage, run `plan`, review digest and acquire own lease. Apply only on complete agreement and independently verify live result and migration retry.
7. Update vault notes, close the lease without advancing unreviewed windows, sync and archive the complete spec.
