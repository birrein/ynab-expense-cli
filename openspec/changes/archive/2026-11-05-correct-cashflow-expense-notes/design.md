## Context

Existing note amendments are intentionally restricted to the Gmail ledger; statement-backed cashflow entries have separate provenance.

## Goals / Non-Goals

**Goals:** Allow a narrow in-place descriptive correction to one verified cashflow expense.

**Non-Goals:** Altering tags, sources, splits, dates, amounts, categories, or absent ledger records.

## Decisions

Require complete exact old transaction object and source in cashflows, a unique textual substring not overlapping URLs, hashtags or source metadata, and independent readback of all other fields. Revalidate under lock after backup and audit to cashflow-specific notes history.

## Risks / Trade-offs

Incorrect identity or metadata mutation → exact object, protected boundaries and verified-ledger checks. Partial write → exact retry only with audit; otherwise investigate.
