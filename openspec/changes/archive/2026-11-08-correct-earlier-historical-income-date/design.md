## Context

The existing income date correction has full snapshot, ownership, backup and independent verification protections. Earlier posting must not broaden the normal later-date modes.

## Goals / Non-Goals

Support one to four days earlier for a positive simple historical income, backed by a single complete statement and a separately inspected receipt. Do not alter any field other than date or generalize to expenses and transfers.

## Decisions

An explicit `earlierPostingEvidence:true` flag is required with `singleStatementEvidence`. Its receipt date must precede or equal the corrected bank date by at most four days, and the statement must cover receipt, corrected and historical dates. A generic bidirectional mode was rejected because it would weaken existing callers' contracts. Daily balance impacts are calculated over the ordered interval, with the actual signed movement direction, and both write-time and independent verification preserve the entire budget.

## Risks / Trade-offs

Matching the same amount alone is insufficient: the operator must inspect independent documents and the adapter rejects nearby competing income, owned sources, stale snapshots and unapproved date ranges. Pending audits continue to block writes and require manual investigation.
