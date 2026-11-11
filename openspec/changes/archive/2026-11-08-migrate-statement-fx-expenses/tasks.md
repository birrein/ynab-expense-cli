## 1. Guarded planning

- [x] 1.1 Add failing tests for candidate identity, source ownership, full snapshots, existing audits and cross-budget replay; confirm failures before implementation.
- [x] 1.2 Implement exact plan and source replay guards; pass the relevant tests.

## 2. Migration and verification

- [x] 2.1 Add failing tests for dual backups, pending intent, both writes, full independent readback, lineage preservation and failed-stage handling.
- [x] 2.2 Implement migration and global pending protection; pass tests including idempotent retry and concurrent drift.
- [x] 2.3 Document operation and recovery in runbook; verify documentation matches tested behavior.

## 3. Release and apply

- [x] 3.1 Run Node and Go suites and strict OpenSpec validation.
