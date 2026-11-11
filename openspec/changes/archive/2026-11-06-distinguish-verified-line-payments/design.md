## Context
Two repayments to the same credit line have equal amounts and distinct bank dates; one is an independently verified transfer in the ledger.

## Goals / Non-Goals
Permit a second clearly distinct bank row without modifying the existing pair or relaxing other duplicate checks.

## Decisions
Use exclusive `distinctVerifiedLinePayment` with statement ID, exact snapshots of prior reciprocal legs, prior bank source, prior and new statement descriptors and evidence. Require same accounts, signs and amount; different valid dates; prior source present in notes, imported ID and verified cashflow ledger with same statement; all matches must be exactly the prior reciprocal pair. New source remains unique. Operator inspects the statement because candidate identifiers and descriptions do not authenticate it.

## Risks / Trade-offs
Adjacent identical payments can still be duplicates if a statement is misunderstood. Exact bank rows, verified prior ledger and complete conflict coverage are required. Existing lease, backup, sync, full readback and retry controls apply.
