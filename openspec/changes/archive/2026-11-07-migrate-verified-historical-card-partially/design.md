## Context

The historical card and principal card coexist. Their imported opening duplicates a substantiated amount of the historical balance, but three historical rows remain excluded. Existing line-payment audit evidence refers to an affected historical transfer and its counterpart. A full offline rehearsal on a private backup moved 2,403 rows, remapped 223 reciprocal legs, retained three exceptions and preserved the principal account balance; this is not a live operation.

## Goals / Non-Goals

**Goals:** Preserve existing IDs, source identifiers, notes, categories, cleared states, transfer topology, schedules, rules, other accounts, user-facing data and audited source evidence. Remove only an exactly matched redundant opening and leave excluded historical rows and their source account open.

**Non-Goals:** Retire unresolved expenses, close the historical account, infer missing transactions, amend categories or synthesize a balance adjustment. Offline rehearsal alone does not authorize relaxing safety checks.

## Decisions

- Require exact source and destination accounts, complete snapshot digest, immutable excluded IDs and exact opening snapshot. The operator checks statements, duplicate evidence and history before preparing a plan. The sum of moved historical rows must exactly equal the opening amount; do not select rows merely to force equality.
- Generate the complete account and reciprocal payee remapping deterministically; inspect source-ledger and audit references, reject unknown references, self-transfers, changed rows, ambiguous overlaps, unsupported splits and account configuration references. Bind apply to a canonical digest of the preview and both budget and state inputs.
- Store a pending audit and backup before the first mutation; globally reject financial writes while migration remains pending. A completed audit allows only exact read-only retry. Preserve the prior line-payment evidence unchanged, with a separate mapping from its exact old snapshots to exact new snapshots; only a completed migration audit may authorize that mapping for an already registered source. All other conflicts remain review.
- Use the same transaction batch operation rehearsed offline with transfers not auto-created; verify every changed and unchanged transaction, nested split, account, payee, rule, schedule, balance and reciprocal link in an independently downloaded snapshot. Verify destination balance at each existing date from the opening onward. Detect concurrent changes and retain pending audit and backup upon failure.

## Risks / Trade-offs

Partial writes across batches → durable pending audit, financial-write guard, no automatic retry, backup and explicit investigation. Prior audit references can become stale → preserve original evidence and validate only an exact completed mapping. An isolated offline rehearsal cannot establish live state or audit compatibility → live plan and full verification are mandatory. The excluded duplicate gross and two disputed purchases remain visible and the historical account must not be closed or reported as fully reconciled.
