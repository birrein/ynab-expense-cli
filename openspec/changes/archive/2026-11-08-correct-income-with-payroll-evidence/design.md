## Context

The current income date correction accepts two statements or one covering statement and a Gmail receipt; an employer payslip can provide a different independent source of payroll identity.

## Goals / Non-Goals

**Goals:** Permit a uniquely identified same-month payroll advance with a covering bank statement and a separately inspected payslip.

**Non-Goals:** Interpret PDFs automatically, create an income, infer dates from a payslip, or alter existing evidence modes.

## Decisions

Add a mutually exclusive `payrollStatementEvidence` object with payslip ID, month and statement bounds. Require both statement IDs to match and the payslip ID to differ, both transaction dates in the declared month and statement, and reject any equal positive income in that account/month. Reuse the existing snapshot, hash and audited mutation. An independent receipt remains preferred where available; this path is explicit when it is absent.

## Risks / Trade-offs

- [PDF identity is not parsed by the adapter] → Require the operator to inspect complete documents and provide detailed evidence; IDs alone are not proof.
- [Competing payments] → Reject matching amounts in the same month and preserve all existing source, snapshot and retry controls.
