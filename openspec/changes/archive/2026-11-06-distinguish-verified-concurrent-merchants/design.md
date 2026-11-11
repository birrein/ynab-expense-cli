## Context

The existing `distinctVerifiedStatementMatches` mode checks every conflicting snapshot and ledger entry, but requires prior dates to be unique and the new payee to exist. A shared prior date is not ambiguous when the shared statement has distinct merchant rows and each is already tied to its own bank source.

## Goals / Non-Goals

**Goals:** Permit independently inspected, distinct-merchant prior rows with the same date and safely create an exact new payee using the existing guarded path.

**Non-Goals:** Accept two indistinguishable merchants, missing or unverified ledger sources, a prior date equal to the new purchase date, unlisted conflicts, or descriptors as proof of a statement's contents.

## Decisions

Remove only the prior-date uniqueness restriction and existing-payee restriction in this mode. Keep unique descriptor, source and ID checks; match every candidate conflict; revalidate source and snapshots before any write. The operator must read the statement and receipts. Existing payee creation, audit, lease, backup and independent verification remain unchanged.

## Risks / Trade-offs

- Statement descriptions can be misleading: the operator must verify every row and supporting receipt manually.
- Similar names may be ambiguous: existing normalized payee checks and unique descriptor checks remain fail-closed.
