## Context

See proposal.md for motivation. `actual-transaction-notes.mjs` already validates exact identity, ledger records and standalone source lines before a notes-only patch. `actual-daily.mjs` owns the exclusive lock and supplies backup and separate-client download dependencies. Descriptive amendments must keep their protected-token checks.

## Goals / Non-Goals

**Goals:** expose existing hashtags first without inferring tags or provenance; make future additions/creation consistent; retain exact source links, useful prose, financial fields and independent verification.

**Non-Goals:** arbitrary note rewriting, automatic duplicate removal, repairing concatenated Gmail URLs, editing legacy budgets, schedules or automations, altering financial fields or relaxing ledger eligibility. Redundant prose is removable only through the existing evidence-backed literal amendment.

## Decisions

- Introduce `transactionTagsPrefixAmendment:true` with the same identity/evidence fields and no tag/replacement fields. Reuse the amendment lifecycle instead of adding a bulk API or allowing general metadata rewriting.
- A small shared pure module recognizes complete Unicode hashtag tokens outside HTTP(S) URLs and source/refund metadata lines. Matching follows complete-token boundaries and rejects glued sequences such as `#Trip#Other` before relocating partial tokens; duplicate names compare case-insensitively and require review. Preserve spelling and encounter order; do not deduplicate or sort.
- Prefix tokens on one space-separated first line. Remove only their original spans, whitespace-only lines they occupied and edge horizontal whitespace on touched lines. Preserve all untouched lines, punctuation and internal prose whitespace; preserve link bytes. Already canonical notes and notes without tags are no-ops.
- Explicit additions retain the original note byte-for-byte as suffix and put the new bounded ASCII tag on its own first line. An existing single occurrence stays a no-op; relocation is a separate explicit operation. New transaction descriptions use the shared prefix formatter before generated source lines are appended, including split descriptions. Do not generate tags.
- Reject malformed provenance through the existing exact source-line checks. A tag concatenated to a URL is part of that protected URL, never a movable token. Do not split, shorten or reconstruct it. Teja Market must be inspected and, if malformed, reported as blocked with its actual evidence retained.
- Keep strict whole-snapshot comparison, private ZIP/snapshot/candidate audit, owned lease, CLI lock and allowlisted budgets. Record `operation:"prefix-tags"` after independent readback; identical retries recover audit without a second mutation. Keep add-tag audit behavior with its new prefix result.

## Risks / Trade-offs

- Actual has no atomic compare-and-set → retain final pre-write sync/revalidation and independent full readback; stop on drift without automatic rollback.
- Punctuation around an inline tag remains visible after relocation → preserve it rather than infer a prose rewrite; preview shows exact output.
- Some tagged legacy/pending/split/malformed transactions are ineligible → document each skip; do not broaden financial eligibility to finish a batch.
- Changing add-tag layout changes the computed desired state for pre-upgrade candidates → old unverified append-style retries must be inspected against their backup/audit; never guessed or applied as a second addition.

## Migration Plan

Run Node 22.20.0 tests with synthetic financial data; synchronize and validate specs, then archive. Afterwards inventory CLP/USD, capture private full snapshots and ledger, generate exact per-transaction candidates and previews, and apply only eligible changed notes through the adapter under an owned lease. Verify final full snapshots with only planned notes changed, preserve balances/checkpoints and close with `reviewed:[]`, `completeSearch:false`. Retain diagnostics and backups on failure; no automatic budget restore.
