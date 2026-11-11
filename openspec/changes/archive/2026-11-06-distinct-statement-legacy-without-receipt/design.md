## Context

The cashflow classifier already distinguishes receipt-backed legacy matches and persists a full audited candidate. The existing legacy entry can have no payee and no receipt, so fabricating a receipt or changing historical data is unacceptable.

## Goals / Non-Goals

**Goals:** Support one exact unlinked annotated legacy match when two unique rows with different merchants and dates are independently verified in the same statement.

**Non-Goals:** Prove document content in software, alter old entries, infer a category, support same-day or additional matches, or weaken existing receipt-backed paths.

## Decisions

Add a separate `distinctAnnotatedLegacyRows` field with statementFileId, existingStatementDate, existingStatementDescriptor, newStatementDescriptor, existingTransaction and evidence. Require a previously categorized, unlinked, simple legacy movement with descriptive nonempty notes and no payee or imported source; exact date, account, amount and full snapshot must agree, descriptors must differ, and all other nearby matches cause Review. Require the new payee to exist. The operator must inspect both rows and positively link the old notes, date and amount; statements or text asserted in JSON are not verification. Keep the older receipt-backed path unchanged. Audit the exception separately and preserve category-null Review, sources, backup, synchronization, balances and readback. Exact retries retain identity and do not duplicate.

Alternative: loosen existing receipt requirements, rejected because it silently weakens prior guarantees. Another alternative is manually altering the old entry or creating fabricated sources, rejected because it loses provenance.

## Risks / Trade-offs

An annotation and matching row can still refer to different purchases; require the operator to inspect the complete statement and leave Review on ambiguous linkage. This is narrower than accepting generic evidence and cannot mechanically prove identity.

## Migration Plan

Additive optional candidate field; existing candidates behave identically. Revert code only when no active writes or incomplete recoveries exist; preserve prior audit records and backups.
