## Context
Two historical bank-fee records dated later than their bank statement were reimported with precise sources. Both amounts, account and statement period match and no second fee appears in the complete statement.
## Goals / Non-Goals
**Goals:** retire only the exact duplicate, preserve its import ID and notes in audit, and independently prove all other state unchanged.
**Non-Goals:** infer a duplicate from matching amounts alone, change category or retained record, remove transfers or reconciled entries.
## Decisions
Require full old transaction identity, exact retained source and verified statement ID plus explicit evidence. Check source ledger and bounded dates; backup entire budget and original row, sync and revalidate, delete once, sync and independently verify count, exact untouched transactions, balances and audit. Partial success without audit is not retried automatically.
## Risks / Trade-offs
The statement and operator judgment must establish uniqueness. A matching amount alone is not evidence. Unexpected state stops processing.
