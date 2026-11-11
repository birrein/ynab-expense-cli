## Context

See proposal.md for motivation. `actual-transaction-notes` already validates exact transaction and ledger identity, restricts literal descriptive replacements, and provides backup/readback orchestration. Another reconciliation currently owns the authoritative lease. Prior uncommitted work and the previously archived change must remain intact.

## Goals / Non-Goals

**Goals:** Append exactly one user-authorized tag to an existing simple categorized expense and retain all prior notes bytes and financial fields.

**Non-Goals:** Tag removal/renaming, arbitrary note replacement, source metadata edits, automatic travel inference, split/transfer/refund editing, Gmail labeling or taking another execution's lease.

## Decisions

- Introduce mutually exclusive `transactionTagAmendment:true` plus `tag`. Share identity/provenance validation and orchestration with descriptive amendments, but use a strict candidate field allowlist for each operation. The descriptive mode still rejects tags. Opening its replacement syntax was rejected because that permits metadata deletion and arbitrary rewrites.
- Accept a single ASCII tag matching `#[A-Za-z][A-Za-z0-9_-]{0,63}`. Append it on its own final line, adding a separator newline only when needed. Never normalize, reorder or rewrite the old text or source links.
- Recognize whole hashtag tokens in non-URL text, including punctuation boundaries; compare case-insensitively. Existing spelling is preserved. Similar prefixes/suffixes and URL fragments do not count as the requested tag. Reject multiple occurrences rather than deleting existing content. One existing occurrence is a verified no-op with no mutation, backup or new ledger audit.
- Reuse plan/apply lease, lock, exact old-note precondition, backup, final pre-write recheck, sync and independent complete-snapshot comparison. Record `operation:add-tag` and the explicit tag in the existing append-only notes amendment audit after success. A retry against exact desired notes recovers missing audit without repeating the patch.
- Wait for the current reconciliation to close its own lease. Then capture fresh inventory, snapshot and authoritative state before preparing the three explicitly scoped candidates. Use the Google Drive vault path for tracking.

## Risks / Trade-offs

- Tags outside the restricted grammar are rejected → deliberately bounded input; broader syntax needs a separate decision.
- Duplicate tags already in old notes cannot be repaired here → fail without mutation for manual review.
- Actual has no conditional notes update → retain the documented final pre-write check and independent readback; never auto-restore over external edits.

## Migration Plan

Run new tag tests and existing adapter regressions using nvm Node 22.20.0. Strictly validate OpenSpec before live writes. After the other lease closes, plan and sequentially apply only the authorized three candidates. Compare final snapshot and ledger with the fresh baseline, close our lease without reviewed windows, and insert verified tracking in the existing Google Drive hub/monthly note. Retain private backups and diagnostics for recovery; do not implement automatic tag removal or budget restoration.
