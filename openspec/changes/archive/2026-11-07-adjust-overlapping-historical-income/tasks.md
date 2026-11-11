## 1. Safe correction
- [x] 1.1 Add failing behavior tests for valid overlap, stale snapshots, mismatched ledger, pending audit, retries and unrelated changes.
- [x] 1.2 Implement guarded plan, owned lease, durable intent, backup, single amount update and independent full-budget verification.
- [x] 1.3 Wire the dedicated candidate into the daily adapter without weakening other operations; document the evidence and recovery workflow.

## 2. Verification and application
- [x] 2.1 Run targeted and full Node tests and Go tests; obtain independent review and address findings.
- [x] 2.2 Plan, apply and independently verify the evidenced correction, then document resulting cut balances without advancing windows.
- [x] 2.3 Validate and archive this OpenSpec change with synced specification.
