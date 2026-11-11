# Verification — 2026-11-04

- Runtime: nvm Node v22.20.0, no dependency changes.
- `node --test scripts/*.test.mjs`: **195 passed, 0 failed**. Includes formatter, full CLI creation/readback, split notes, existing-source preservation, all amendment operations, lock/lease exclusion, backup/drift/sync/download/invariant failure and retry recovery.
- RED→GREEN evidence retained privately for initial formatter/creation/amendment behavior, full CLI creation preview/readback and the independent review regression. The first formatter pass identified an expectation that incorrectly discarded an untouched line's terminal newline; the expectation was corrected to preserve that byte.
- Independent read-only review found one substantive issue: glued hashtags could be partially relocated and expose duplicates on another pass. Four regression tests failed before the fix, then passed with explicit rejection. The full suite passed afterwards. No unresolved substantive review findings.
- `node --check` passed for the modified operational entry point and amendment/formatter modules.
- Main `actual-transaction-notes` spec synchronized with 3 modified/renamed requirements and 2 new requirements; existing unrelated requirements preserved. Strict change and full OpenSpec validation passed before archive.
- No Git commit: affected scripts/docs were already untracked user work before this change. Focused edits and a private code baseline preserve those existing files; no cleanup/reset or automation changes were performed.

## Operational boundary

Live financial execution follows archive, using the adapter only. Private assessment, exact candidates/previews, per-write backups/readbacks and final report are retained under `/Users/birrein/Actual-pilot/daily/prefix-tags-20261104/`. No transaction payloads or credentials are included in these artifacts.

Only existing eligible categorized simple expenses with authoritative supported provenance can be relocated. Legacy notes absent from that ledger, unresolved categories, unsupported/mismatched/duplicated sources and malformed concatenated Gmail links remain unchanged. Order references written with `#` are excluded from live relocation after semantic preview. The operation does not repair malformed provenance or infer tags. Whole-budget financial state, unrelated notes and review markers must compare unchanged after the run, apart from the explicitly planned target notes. Actual's lack of atomic compare-and-set remains the documented concurrency limitation.
