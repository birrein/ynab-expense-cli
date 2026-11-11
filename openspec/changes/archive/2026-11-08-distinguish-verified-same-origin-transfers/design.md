## Context
The existing `distinctSameOriginTransfer` accepts only unowned legacy pairs without notes or imported IDs. Earlier verified cashflow pairs contain an imported source, notes and an authoritative ledger record.

## Goals / Non-Goals
**Goals:** Add an explicit, separately validated prior-ledger form while preserving the legacy form and all duplicate, lease and independent-readback controls.
**Non-Goals:** Infer the content of a PDF or change an existing transfer or its sources; permit arbitrary nearby matches.

## Decisions
Add optional `priorSource` to the existing exception. Without it, retain legacy behavior. With it, require exact live reciprocal snapshots, a matching registered verified prior cashflow record, a distinct prior source and Gmail evidence present in both legs, and no overlapping message IDs. Independently inspect the shared origin statement and new destination statement; validate their IDs and distinct descriptors. Require exactly the prior origin as the entire conflict set. Audit the supplied exception with the created transfer. This avoids relaxing the guard for unknown historical records or inventing missing source links. Existing ledger entries may lack Drive IDs: require operator-provided shared statement and prior bank receipt rather than rewriting historical notes.

## Risks / Trade-offs
- [PDF IDs alone do not establish content] → Require operator inspection, explicit descriptors and documentary evidence before plan.
- [Stale, reused or extra sources] → Match complete snapshots, reciprocal IDs, status, amounts, accounts, dates and source sets; reject any additional conflict.
- [Interrupted write] → Existing backup, sync, lease, readback and stable-source retry paths remain unchanged.
