## Context
The historical income-date adapter already handles exact transaction snapshots, a receipt plus a covering statement, full plan hashes, pending audits and independent verification.

## Goals / Non-Goals
**Goals:** Reuse those invariants for a narrowly defined negative expense with its own audit namespace and global pending guard.
**Non-Goals:** Correct splits, transfers, imported/owned transactions, alter categories or create any expense.

## Decisions
Add `historicalExpenseStatementDate` as a mutually exclusive mode in the existing historical statement-date module. Require the single-statement receipt evidence and a categorized expense; accept receipt date equal to the old date or one day earlier for late-night manual entries. Require both old and receipt dates inside the covering range, and the posting date one to four days later than the old date. Use a distinct `expenseStatementDateCorrections` audit map and include it in the global pending guard. Preserve the old income flag, audit namespace and behavior exactly. Reuse the same daily balance verification, which naturally handles either sign. The operator must inspect receipt and complete statement; identifiers alone are not proof.

## Risks / Trade-offs
- Same-value distinct transactions → fail on any nearby equal-amount outflow.
- Receipt and recorded date may disagree → allow only one earlier day with verified bank receipt, recipient and unique statement row.
- Partial write → durable pending state blocks financial mutations; no automatic rollback or retry.
