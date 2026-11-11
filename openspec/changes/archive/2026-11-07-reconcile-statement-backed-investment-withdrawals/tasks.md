## 1. Reporting and evidence

- [x] 1.1 Verify native starting balances do not appear as ordinary earned income in the user's reports, or define and validate an appropriate report filter before any real write.
- [x] 1.2 Independently verify both statement pages and account identities for the withdrawal and document the checkpoint, its date and the one-peso difference.

## 2. Safe checkpoint operation

- [x] 2.1 Add meaningful tests for validation, collisions, interrupted writes, dated opening transaction, invariant checks and exact readback-only retry.
- [x] 2.2 Implement the checkpoint operation under lease, lock, backup and pending audit; run focused tests.
- [x] 2.3 Update the runbook, pass the relevant Node and Go suites and validate the change.

## 3. Reconciliation

- [x] 3.1 With independently verified evidence, plan and apply the checkpoint and native transfer, then independently verify both accounts and the ledger.
- [x] 3.2 Document the result, remaining conversion and the unreconciled limitations; update Gmail labels only after verified completion.

## 4. Finalize

- [x] 4.1 Verify every task and archive the change with OpenSpec after the reconciliation is complete.
