## 1. Evidence and preview

- [x] 1.1 Implement tests for exact partial migration, excluded rows, transfer topology, balance series, duplicate and configuration conflicts; observe failure first.
- [x] 1.2 Build a deterministic, digest-bound preview and validate it against an isolated copy of the full budget.

## 2. Preserve prior audit

- [x] 2.1 Test exact old/new mapping for an already registered line-payment source; reject pending, changed and unrelated evidence.
- [x] 2.2 Implement migration-bound verification without modifying original source evidence and verify the original candidate remains idempotent.

## 3. Safe execution

- [x] 3.1 Test lease, lock, backup, pending-audit write guard, interruption and complete readback on realistic nested splits.
- [x] 3.2 Implement bounded batch application and independent full-budget verification; reproduce it on an offline copy with no remote writes.

## 4. Operational delivery

- [x] 4.1 Document the allowed evidence, excluded records, recovery procedure and permanent audit guarantees.
- [x] 4.2 Run Node and Go suites and validate OpenSpec before archiving the completed change.
