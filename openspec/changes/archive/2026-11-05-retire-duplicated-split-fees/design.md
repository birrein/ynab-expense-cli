## Context

The existing aggregate retirement intentionally rejects split parents. The duplicate split contains the same fee and tax that are now held as verified individual cashflow records, with different bank payee identifiers.

## Goals / Non-Goals

**Goals:** Preserve the individually sourced records and explicitly check every child and old parent exactly.

**Non-Goals:** General split migration, reconciled transactions, source replacement or categorization.

## Decisions

A dedicated operation carries the full old parent including ordered children and exact retained IDs. Every child is bijectively matched by amount/category to a ledger-owned simple expense on the same date and account; the operator inspects bank statement and merchant identities. Use official Actual API only, whole-budget backup, sync/revalidate and independent readback of all other records and balances. Record the old full split in the audit.

## Risks / Trade-offs

Equal amounts may coincide → verify statement descriptions and child notes manually. Partial API write → refuse automatic retry without matching audit, inspect backup and source first.
