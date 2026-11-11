## 1. Amendment safety

- [x] 1.1 Add exact candidate, provenance, ledger and bounded-replacement validation; verify rejection and idempotency tests.
- [x] 1.2 Implement notes-only orchestration with backup, lease recheck, sync and independent full-snapshot verification; verify injected failures and unchanged ledger on failure.

## 2. Adapter and operations

- [x] 2.1 Wire plan/apply through existing lock and cleanup and document candidate/recovery; verify CLI lock/lease tests and existing adapter tests on Node 22.20.0.
- [x] 2.2 Validate the OpenSpec change and review local diff without disturbing pre-existing files; verify strict validation and test output before live writes.
- [x] 2.3 Plan and sequentially apply only matching authorized corrections, verify independent results and unchanged review markers, and update existing vault tracking with verified IDs and private audit location.
