## Context

The migration already checks full snapshots, source ownership, and all USD amounts within four days. An independent statement may identify a different merchant's legitimate equal-amount purchase; blindly ignoring that match would be unsafe.

## Goals / Non-Goals

**Goals:** Allow evidence-backed exact peer matches without weakening checks for sources, dates, account, full-snapshot drift or complete readback.

**Non-Goals:** Infer identities from amount alone, alter peers, or automatically read bank statements.

## Decisions

Allow an optional `distinctStatementPeers` block containing the migrated statement row reference/date and a nonempty list of exact peer transaction snapshots plus distinct statement row references/dates. Require complete coverage of every nearby equal-amount USD peer, same destination account and amount, existing different payee IDs, date alignment within four days, pairwise unique reference numbers, and explanatory evidence. The operator independently reads the statement and provider records. Candidate, statement references and peer snapshots are bound into the already required plan hash and audit. No block means the old strict rejection still applies. An extraneous, stale or incomplete peer block fails closed.

## Risks / Trade-offs

- The operator can provide false statement facts → require precise references, dates, merchant identities, evidence and user review of preview; the adapter does not claim to parse the PDF.
- Transactions may change between review and write → exact snapshots and full-plan hash revalidation.
