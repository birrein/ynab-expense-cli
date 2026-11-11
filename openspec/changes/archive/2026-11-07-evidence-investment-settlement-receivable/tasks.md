## 1. Evidence and validation

- [x] 1.1 Add failing tests for valid receivable checkpoints and for missing, conflicting, duplicated or misleading evidence; run the focused Node tests and observe the expected failure.
- [x] 1.2 Implement the separate receivable classifier and native checkpoint lifecycle with a durable pending audit; run focused tests including retry and partial-write guards.

## 2. Integration and safeguards

- [x] 2.1 Route the new operation through the existing plan/apply lease and lock flow; verify both read-only plan and owned-run enforcement in tests.
- [x] 2.2 Document operator evidence, reporting filters, partial-history limitations and safe downstream transfer in the runbook; inspect the resulting instructions.
- [x] 2.3 Run all project Node and Go tests and strict OpenSpec validation; verify no unrelated worktree changes are overwritten.

## 3. Verified financial operation

- [x] 3.1 Archive and independently verify the source documents in the appropriate Drive location; confirm existing reporting filters and budget state before planning.
- [x] 3.2 Plan and apply the exact settlement checkpoint and native bank transfer with backups and independent readback; preserve source IDs and stop on any pending audit.
- [x] 3.3 Verify labels, account balances, ledger and documentation; close the directed run without advancing unrelated windows.
