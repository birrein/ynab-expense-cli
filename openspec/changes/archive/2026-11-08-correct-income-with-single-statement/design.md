## Context
Historical income date correction normally takes two distinct bank statements. A single monthly statement can cover both dates, while a bank's transfer notice independently identifies the operation.

## Goals / Non-Goals
**Goals:** Support one fully covering statement with a separate precise bank receipt while maintaining every existing transaction and readback invariant.
**Non-Goals:** Infer identity from amount alone, treat statement IDs as proof, extend the date window, modify categories, or weaken the original two-statement mode.

## Decisions
An explicit `singleStatementEvidence` object carries `receiptId`, `receiptDate`, `statementFrom` and `statementTo`; the existing two statement ID fields must be identical in this mode and both dates must fall inside the range. The receipt date must equal the old transaction date. The operator personally reads the entire statement and receipt to verify account, payer, amount and date. Reject receipt ownership by the ordinary ledger or existing source references. The hash already binds candidate, ledger and snapshot; backup, pending intent and independent readback remain unchanged. Separate state and fabricated second statements were rejected because they would distort provenance.

## Risks / Trade-offs
- The statement boundaries are supplied by the operator → validate format, ordering and coverage and inspect the complete statement.
- Repeated amount may be an unrelated payment → require exact payer and identity, receipt and no nearby same-amount income.
- Interrupted write → existing global pending guard blocks automatic financial mutation.
