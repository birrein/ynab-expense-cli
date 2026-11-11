## Context
A historical pair aggregates three transfers on the same date. Source-ledgered individual pairs independently match bank notifications and statement rows.
## Goals / Non-Goals
**Goals:** remove only the duplicate pair, preserve provenance and the individual transfers and prove both balances.
**Non-Goals:** infer aggregation from an amount alone, handle partial missing legs or alter components.
## Decisions
Require complete exact old-leg fields, explicit component pair IDs and source IDs, unique pair links, sum, same date and accounts, statement and evidence. Reject ledger-owned old legs. Backup, revalidate, call delete for each historical leg, synchronize and independently compare every remaining transaction, all nontransaction data and both balances. Audit full original rows; retry requires audit.
## Risks / Trade-offs
Evidence review is mandatory; a partial write without audit must be investigated and not retried by changing identities.
