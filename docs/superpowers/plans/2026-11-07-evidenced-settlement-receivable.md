# Evidenced Settlement Receivable Implementation Plan

> **For agentic workers:** Execute the OpenSpec tasks in order; preserve user work and operate only on the directed Actual budgets.

**Goal:** Record a documented net investment-settlement receivable and its bank settlement without inventing cash history or ordinary income.

**Architecture:** A separate candidate and audit family use the proven native opening lifecycle with receivable-specific provenance and reporting evidence. A normal cashflow transfer settles it after an independent bank check; incomplete investment cost and bonus history stay unresolved.

**Tech Stack:** Node 22.20.0, Actual official API, Node test runner, OpenSpec, Go CLI.

**Spec:** `openspec/changes/evidence-investment-settlement-receivable/`.

## Global Constraints

Keep source identities stable. Require own lease, lock, backup, pending audit, revalidation, independent download, exact report evidence, no unrelated writes and explicit checkpoint limitations.

## Tasks

- [x] Write focused tests for exact source identities, dates, evidence, collisions and guarded retry; run and confirm failure because the new operation is absent.
- [x] Implement a dedicated module and route that preserve the existing checkpoint algorithm and enforce the new evidence requirements; run focused tests.
- [x] Update the runbook and run the Node and Go suites plus strict OpenSpec validation.
- [x] Verify the original vendor PDF and recipient bank statement, reports and current state; plan and apply the checkpoint and separately plan/apply the bank transfer.
- [x] Read back account, transfer, source labels and notes; close the lease without changing unrelated markers and archive the completed specification.
