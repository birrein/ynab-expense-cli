## Context

See proposal. Existing same-amount exceptions either require one unrelated merchant or multiple rows for the same payee and category. Earlier statement-backed entries have verified stable bank sources and explicit statement links in both notes and ledger.

## Goals / Non-Goals

**Goals:** Cover every nearby matching expense with an exact unchanged prior snapshot and verified cashflow ledger record from the same statement, each with a distinct merchant and date.

**Non-Goals:** Infer rows from IDs, create payees, change existing entries, accept legacy unlinked records, bypass ambiguity, support same-date rows, or classify unknown consumption.

## Decisions

Add an independent opt-in `distinctVerifiedStatementMatches` candidate with a shared statement ID, new descriptor, evidence and at least two existing matches containing exact transaction snapshot and original statement descriptor. The operator independently inspects the statement and proves each row. Require one unique prior row per ID, date, imported bank source and normalized merchant descriptor; require each prior note and independently verified ledger entry to reference the same statement and exact identity, account, date, amount, category and source, with status registered or review. Permit a prior truncated statement descriptor only when it is a prefix of the corresponding payee name. Enforce exact set equality with all nearby matches; preserve raw sources, category status, backup, prewrite revalidation and complete independent readback. No payee creation in this path. Evidence text does not prove a row.

Alternative: ignore the two matches or rewrite prior expenses, rejected because that bypasses provenance and can duplicate spending. Loosening existing same-merchant path is rejected because it changes old semantics.

## Risks / Trade-offs

An operator can misread a statement even when IDs and snapshots match; require manual full-document verification and Review if uncertain. Concurrent changes fail before write and readback checks all other financial records.

## Migration Plan

Additive optional candidate field; existing paths remain intact. Preserve audit and backups on rollback. Do not retry with changed sources after a partial write.
