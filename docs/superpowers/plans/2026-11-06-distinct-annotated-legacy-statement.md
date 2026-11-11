# Distinct Annotated Legacy Statement Implementation Plan

> **For agentic workers:** Use `openspec-apply-change` and execute these steps sequentially; the user requested autonomous completion.

**Goal:** Record a distinct statement-backed expense when one annotated legacy movement without receipt or payee matches a different dated statement row.

**Architecture:** Add one opt-in classifier mode to `scripts/actual-cashflow.mjs`, keeping the receipt-based mode unchanged. Verify full prior snapshot, exact original date, descriptive note, account, amount, different merchant descriptors, one and only one potential duplicate, and unchanged records after write; audit the complete exception.

**Tech Stack:** Node 22.20.0, node:test, Actual official API, OpenSpec.

**Spec:** `openspec/changes/distinct-statement-legacy-without-receipt/specs/actual-confirmed-cashflows/spec.md`.

## Constraints and review focus

- No fabricated receipts or source identifiers; independently inspect the statement and manually establish prior-row linkage.
- A missing or generic annotation, same-day row, mismatched identity, changed snapshot, extra match, mixed exception or preexisting source conflict must fail closed.
- Preserve lease, lock, audit, backup, sync, unchanged prior transactions and independent readback.
- Nullable categories require Review and an explicit reason. Preserve existing behavior and do not create payees in this exceptional path.

## Steps

1. Add behavior tests to `scripts/actual-cashflow.test.mjs`; run them first and confirm that the new valid candidate fails.
2. Implement the new candidate flag and separate audited evidence in `scripts/actual-cashflow.mjs`; run the complete cashflow tests, including retry and unchanged-transaction checks.
3. Update `docs/actual-gmail-runbook.md`, run adapter tests and strict OpenSpec validation, mark tasks and archive the change after syncing its spec.
4. Verify both bank rows and the legacy entry, prepare a private candidate, preview, apply under an owned lease only if the plan agrees, independently read back and document Review.
