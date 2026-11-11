## Context
The completed operation-date audit assumes both original legs still retain the earlier operation date. A newer independently verified posting date changes one leg, so the older audit's strict repeat check must understand an explicitly linked later result.

## Goals / Non-Goals
**Goals:** Retain both audits, bind a later correction to the exact previously verified pair, and preserve safe independent readback and repeat verification.
**Non-Goals:** Infer dates from identifiers, rewrite prior audits, bypass collisions, or support chains of arbitrary length.

## Decisions
Use an explicit `priorTransferDateCorrection: true` flag in the new candidate. Require a completed prior audit indexed by the same origin whose resulting exact legs equal the new snapshots, and prohibit this flag without it. Reject a prior audit without the explicit flag. The plan hash already binds the stable full ledger and snapshot. For a repeat of the prior audit, accept the independently completed later audit only when its explicitly linked candidate's input legs exactly equal the original audit's result and the current legs equal its output. Pending or altered audit must fail closed. This preserves the historical audit rather than rewriting it; ignoring old audits was rejected because it invalidates their verification.

## Risks / Trade-offs
- A provider statement ID alone proves nothing → the operator independently inspects both statements and receipt.
- An interruption can leave one leg changed → existing durable pending guard blocks further writes.
- A seemingly valid later audit may be unrelated → compare full leg snapshots, currency, and explicit linkage.
