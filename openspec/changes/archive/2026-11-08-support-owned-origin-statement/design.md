## Context

An owned transfer may have been originally verified using either account's statement. Both statements must still be independently inspected for a posting-date correction.

## Goals / Non-Goals

**Goals:** Allow an original origin statement as provenance without changing any other safety control.

**Non-Goals:** Infer statement content, omit either statement, add sources to existing transactions, or alter balances and original evidence.

## Decisions

Accept the original receipt and at least one of the two distinct current statement IDs among the unchanged original sources. Require both current statements, full snapshots and all existing verification. This is narrower than accepting an unrelated original statement.

## Risks / Trade-offs

An ID does not prove statement content: operators must inspect both statements and receipt, and compare dates, account, amounts and possible duplicates before applying.
