## Context

A canceled card-paid order was credited to a merchant wallet. Four later receipts document wallet spending, one sharing a receipt with an already registered card portion. There is no independent opening balance and the provider export reports default card details even for wallet-paid trips, so the full receipts and bank statement are authoritative for final settlement.

## Goals / Non-Goals

**Goals:** Correct CMR's confirmed debt, represent four wallet-funded expenses and preserve existing card portions and source ownership.

**Non-Goals:** Assert the wallet's balance, attribute fungible funds to specific later rides, invent rewards or their posting dates, or mark unrepresented reward activity complete.

## Decisions

- The same-day card charge and wallet refund are economically a card-to-wallet transfer: record a native linked pair with detailed note and both receipt links, not an expense plus a fake refund to the card. The account is named explicitly as partial, remains on-budget and has no invented nonzero opening. Its displayed balance is only the net of recorded events. Alternative of charging the original canceled meal and adding wallet expenses double counts consumption.
- Record four separate wallet expenses in Transportation with each original receipt. The mixed-payment receipt is linked to both account legs in a durable grouping audit while its prior `cashflows` entry remains byte-for-byte intact. No alternate Gmail identifier is invented or used to bypass source ownership. Reserve the exact source IDs in the adapter's normal financial entry paths to prevent duplicates.
- Require precise existing card source and transaction snapshots, statement ID, original receipts, explicit dates/amounts and total, and collision checks across all accounts. A digest binds the full budget including dashboards, stable ledger and candidate.
- Before first creation persist a pending audit. Execute API account creation, reciprocal transfer and wallet expenses, storing each returned ID or discovering it safely by stable evidence; no automatic retry after a partial failure. Fresh independent download must prove exact pairs, sources, balance changes and preserved unrelated data. All financial writes block while pending.
- Only update Gmail labels after all components and notes of each specific receipt are verified; keep Review where bonus credits, other parts or notes remain unresolved. Preserve all unrelated labels and unread state.

## Risks / Trade-offs

- Wallet balances are fungible and opening unknown → record changes only, visibly mark account partial, and make no claim that a particular peso funded a particular ride.
- Missing bonus credits make the on-screen balance incomplete → state this in account naming and documentation; investigate separately, without fabricated posting dates.
- Multi-stage API writes can be interrupted → durable intent, backup, lock and manual investigation, plus offline integration test before any live mutation.

## Migration Plan

Validate each receipt and complete statement, inspect duplicates and ledger, then implement test-first; run full suites and realistic offline API rehearsal. Apply an exact reviewed live plan under lease, independently verify, document limitations, handle labels only after verification, and archive the spec.
