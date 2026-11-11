## 1. Safe tag amendments

- [x] 1.1 Implement mutually exclusive tag candidates, bounded syntax, append-only text and duplicate handling; verify positive, malformed, metadata and token-boundary tests.
- [x] 1.2 Reuse lease/lock, backup, sync and independent readback with tag-specific audit; verify failed mutations, recovery, no-op and existing descriptive amendment tests.

## 2. Integration and authorized application

- [x] 2.1 Document tag candidates and recovery, wire plan/apply and validate the change; verify adapter regression tests and strict OpenSpec validation before writes.
- [x] 2.2 Wait for the existing lease to close, inspect fresh identity/category/source state, then plan and apply the three authorized tags; verify the full final snapshot, unchanged ledger fields and checkpoints, and closed own lease.
- [x] 2.3 Update the Google Drive vault hub and October tracking with verified IDs, tag and audit location; verify original content is preserved.
