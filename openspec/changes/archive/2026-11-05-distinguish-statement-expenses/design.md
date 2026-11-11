## Context
A CMR statement lists Apple and Microsoft purchases with equal amounts on adjacent dates. Their separate receipts and exact existing transaction establish that they differ.
## Goals / Non-Goals
**Goals:** permit the uniquely identified pair with explicit evidence and unchanged surrounding ledger.
**Non-Goals:** infer purchases from amount alone, bypass additional matches or alter existing transactions.
## Decisions
Add distinctStatementExpense with exact prior transaction, prior receipt, shared statement and evidence. Require candidate receipt distinct from prior, both merchants different, original notes containing its receipt and shared statement, exact same account and amount, and exactly one match in the duplicate window. Revalidate immediately before writing and include exception in audit.
## Risks / Trade-offs
Operator independently verifies statement and receipts. Any additional candidate or conflicting identity fails closed.
