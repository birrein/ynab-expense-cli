## 1. Evidence and design

- [x] 1.1 Read both bank statements, historical comparison and sender receipts; record the account-alias evidence and its limitations in the reconciliation notes.
- [x] 1.2 Verify the official API moves the reciprocal source leg when changing the destination payee in a private offline budget copy.

## 2. Implementation

- [x] 2.1 Add failing tests for exact source correction, duplicate/source ownership, pending audit, invariants and completed retry; verify failures before implementation.
- [x] 2.2 Implement the guarded operation and CLI dispatch; run focused tests and verify isolated full-budget readback and recovery behavior.
- [x] 2.3 Document the operation and run Node and Go suites plus strict OpenSpec validation.

## 3. Reconciliation

- [x] 3.1 Plan and apply the evidenced transfer correction under its own lease; independently verify both transactions and account balances.
- [x] 3.2 Document source, backup and result; preserve Gmail labels and close without advancing daily windows.
- [x] 3.3 Verify all tasks and archive the completed, synchronized change.
