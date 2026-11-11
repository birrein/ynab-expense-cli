## Context

See proposal.md for motivation. The operational Actual adapter already provides private backups, per-process clients, an exclusive directory lock and an authoritative run lease. It has no atomic server compare-and-set API. Existing files include unrelated uncommitted work and must be preserved.

## Goals / Non-Goals

**Goals:** Correct a bounded descriptive fragment of a simple categorized expense, with explicit expected state and independently verified notes-only changes.

**Non-Goals:** Automatic category-resolution note rewriting, split/transfer/refund editing, source enrichment, Gmail labeling, archived-budget edits, dependency upgrades or advancing review windows.

## Decisions

- Introduce `transactionNotesAmendment:true` in plan/apply, dispatched before normal candidates. A separate module keeps policy and orchestration directly testable without a server or Keychain. Overloading `resolveId` was rejected because it deliberately changes category only.
- Require transaction ID, payee ID, account, date, amount, resolved category, original source IDs, exact `oldNotes`, one unique `oldText` and `newText`, plus evidence. Replace a literal fragment rather than accepting arbitrary full replacement notes. Reject metadata, links, tags, newlines or conflicting operation fields in that fragment.
- Validate every original source against transaction and authoritative ledger, preserving ledger records and adding amendment audit history only after readback. A retry at the exact desired notes is independently verified without another write or backup.
- Use existing lock and lease; download the allowed currency budget, validate catalog and ledger, back up, sync and compare a fresh snapshot before the sole notes patch. Recheck the lease immediately before mutation. Download through a second client after sync and compare the complete snapshot with only the target notes changed.
- Record before/after notes and evidence in the private backup and audit history. Failures retain diagnostics and do not claim success or advance markers. Never automatically restore an entire budget after a verification failure.

## Risks / Trade-offs

- External edits after the final pre-write check remain possible because Actual has no conditional mutation → minimize the interval, require exact preconditions and report any readback drift; do not overwrite or roll back unrelated changes.
- Strict ledger/catalog checks reject historical transactions or hidden categories → stop for review rather than broaden scope.
- An interruption after sync can leave a successful edit without a ledger audit → reuse the identical candidate, independently verify the desired state and record a recovered audit without repeating mutation.

## Migration Plan

Run isolated unit/orchestration/CLI safety tests and existing adapter tests on Node 22.20.0. Validate OpenSpec. Inspect current authorized transactions, plan each candidate, acquire a new lease only if idle, then apply sequentially. Close with no reviewed windows and verify unchanged markers. Update existing vault tracking with verified results. Rollback, if needed, is a separately reviewed reverse amendment using exact current notes; backups are retained privately.
