## Context

Historical transfers are reciprocal Actual transactions. The existing destination correction changes the source payee, which moves the opposite leg through the official API. In this case the corresponding inverse is to change the destination payee to the new origin's transfer payee. This must be verified against an offline copy before touching the real budget.

## Goals / Non-Goals

Correct one source of an existing, simple, unowned, unreconciled same-currency pair, preserving IDs and destination balance. Do not create a transfer, edit database files, make payments or resolve unrelated account differences.

## Decisions

- Require exact old origin and destination snapshots, explicit new origin, distinct source and destination statement identifiers, a receipt identifier and human-reviewed evidence. Evidence identifiers alone do not prove document content.
- Reject additional matching entries within four days in any of the three accounts, source ownership, changed snapshots, mismatched reciprocal legs or missing transfer payees. Preserve notes, cleared state and imported metadata by requiring unowned, unannotated historical legs.
- Use a single official API update on the destination transfer payee. Before mutation record pending audit after a backup and revalidation. Synchronize and independently download to verify the complete budget, both IDs, all invariant fields, exact changes in the three balances and unchanged other records.
- Fail closed on pending audit. Only an identical completed audit permits a read-only retry. Offline verification must test actual API semantics and retry safety; mocks alone cannot establish counterpart behavior.

## Risks / Trade-offs

- [Account alias uncertainty] The operator must review both statements and additional evidence proving destination identity; similar numbers alone do not establish it.
- [Concurrent writes] Revalidation and independent readback detect interference; Actual offers no atomic compare-and-set.
- [Interrupted update] Pending audit and backup block automatic repeat; inspect actual pair and backup before recovery.

## Migration Plan

Validate unit tests, whole Node and Go suites, and a local isolated budget copy. Apply only after source documents and preview match; retain backup and verification audit. Close the directed lease without advancing daily windows, then sync and archive the complete spec.
