## 1. Evidence and safety

- [x] 1.1 Add failing behavioral tests covering evidence, stale ledger, refund bounds, duplicate scans and interrupted intents; run them and observe the expected failure.
- [x] 1.2 Implement statement refund classification and make the validation tests pass.

## 2. Execution and verification

- [x] 2.1 Test and implement lease, backup, persisted intent, one write, independent readback and exact idempotent retry; verify interrupted writes cannot retry silently.
- [x] 2.2 Wire the operation into the daily CLI and document its candidate and recovery behavior; verify Node tests and CLI checks.
- [x] 2.3 Validate the change and all relevant tests, then archive and sync its spec after all tasks pass.
