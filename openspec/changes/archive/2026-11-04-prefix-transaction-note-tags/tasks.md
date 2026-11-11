## 1. Shared formatting and future creation

- [x] 1.1 Add failing synthetic tests in `scripts/actual-note-tags.test.mjs` for complete Unicode tokens, inline/trailing/multiple tags, whitespace, no-op, duplicates, URLs and metadata; implement `noteTagTokens(notes)` and `prefixNoteTags(notes)` in `scripts/actual-note-tags.mjs`; verify RED then GREEN with `node --test scripts/actual-note-tags.test.mjs`.
- [x] 1.2 Add `candidateTransactionNotes(candidate)` in `scripts/actual-daily-policy.mjs` and use it on new transactions in `scripts/actual-daily.mjs`; format split notes without rewriting existing-source notes; verify formatter/source preservation tests and existing policy tests with Node 22.20.0.

## 2. Explicit amendment and lifecycle

- [x] 2.1 Add failing prefix-amendment tests to `scripts/actual-transaction-notes.test.mjs`, then support `transactionTagsPrefixAmendment:true` and leading add-tag notes through the existing lifecycle; verify previews, rejection of mixed fields/flags and duplicates, manual/Gmail provenance, exact no-op/retry and `prefix-tags` audit.
- [x] 2.2 Route the new operation through `scripts/actual-daily.mjs`; extend CLI lock/lease and runtime failure tests to relocation, including malformed concatenated source, foreign/lost lease, backup, drift, sync, download and unrelated snapshot/balance changes; verify no success audit or mutation on pre-write failure.

## 3. Integration, documentation and OpenSpec

- [x] 3.1 Update `docs/actual-gmail-runbook.md` with candidate fields, prefix preview/application, duplicate/malformed-provenance rules and old append-candidate recovery limitation; verify examples against tests without storing financial payloads in Git.
- [x] 3.2 Run all `scripts/*.test.mjs` under nvm Node 22.20.0, review the scoped patch independently, address substantive findings with regression tests, then synchronize main specs and validate/archive this complete change. Evidence goes in `verification.md`; preserve unrelated files and automation configuration.

The implementation plan lives with this OpenSpec change and is executed inline as authorized. The separate post-archive financial run is operational validation, not a prerequisite for archiving implemented behavior. It must retain a private candidate/preview/report, record individual skips, verify full CLP/USD snapshots and ledger invariants, and close its own lease without advancing checkpoints.
