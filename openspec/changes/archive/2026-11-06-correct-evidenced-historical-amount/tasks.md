## 1. Safety and implementation

- [x] 1.1 Add failing tests for identity, evidence, cleared preservation, unsupported records and audited retries; run them under Node 22.20.0.
- [x] 1.2 Implement preview and guarded update with backup, independent full readback and exact balance verification; run the focused tests.
- [x] 1.3 Wire the adapter dispatch and document the candidate and recovery procedure; verify existing adapter tests still pass.

## 2. Verification and reconciliation

- [x] 2.1 Validate OpenSpec and run the relevant adapter and CLI tests.
- [x] 2.2 Preview and apply the Microsoft correction only if fresh state and independent sources agree; verify the resulting amount, flags, balance and source labels.
- [x] 2.3 Update the monthly note and hub, close the directed run without advancing windows, and verify the lease is released.
- [x] 2.4 Sync and archive the completed OpenSpec change; verify no tasks remain.
