## Purpose

Represent a documented card charge refunded to a merchant wallet and later verified wallet-funded rides without inventing an opening balance or duplicating a mixed payment.

## ADDED Requirements

### Requirement: Reconstruct only independently evidenced wallet cash flows
The adapter SHALL require exact card account and existing mixed-payment transaction and ledger snapshots, independently reviewed initial and updated order receipts, the card statement, each ride receipt with date and wallet amount, existing transportation category and counterparty, unique stable source identities, and a clearly named partial wallet. The operator SHALL read and match each source and inspect existing transactions before planning. The refund SHALL be represented as an equal native transfer from the charged card into the partial wallet, with notes explaining the canceled purchase and wallet refund; it SHALL NOT create a separate consumption for the canceled order. Each evidenced wallet-paid ride portion SHALL be an expense, and the already-recorded card-paid portion SHALL remain unchanged. Coincidental arithmetic SHALL NOT be treated as proof of which fungible balance funded each ride.

#### Scenario: Mixed-payment ride with an existing card expense
- **WHEN** a ride receipt proves a card amount plus a distinct wallet amount and the exact existing card expense and ledger match that amount
- **THEN** the plan SHALL preserve that card expense and create only the missing wallet expense, linking both to the same receipt in the audited source group.

#### Scenario: Source or duplicate is ambiguous
- **WHEN** any receipt, card statement, account, amount, date, category, existing ledger, candidate source, nearby possible duplicate or snapshot conflicts
- **THEN** the operation SHALL stop without writing.

### Requirement: Distinguish partial movement reconstruction from wallet reconciliation
The operation SHALL create or select a clearly identified partial on-budget wallet and SHALL NOT claim the actual opening or historical closing balance is known. It SHALL record only the evidenced transfer and expenses, not invent an opening, other wallet credits, cashback dates or unknown transactions. The audit and user-facing notes SHALL state the partial account's balance is a sum of included deltas, not a verified provider balance.

#### Scenario: Unknown starting balance
- **WHEN** the initial wallet balance or unrelated bonus-credit chronology is unknown
- **THEN** the verified events SHALL remain distinguishable from the unknown opening and no balancing adjustment SHALL be invented.

### Requirement: Audit, verify and recover the complete group
The adapter SHALL require an owned lease and lock, exact digest binding the complete budget, ledger, all sources and candidate, backup and revalidation, and a durable pending audit before account or transaction creation. It SHALL block unrelated financial writes while pending, synchronize and independently verify both reciprocal transfer legs, all wallet expenses, source links, balances, account metadata and the entire unrelated budget before marking the audit complete. A completed exact retry SHALL verify without writing; a failure SHALL retain pending evidence for investigation.

#### Scenario: Interrupted multi-step creation
- **WHEN** any step fails or the independently downloaded budget differs
- **THEN** the audit remains pending, all financial writes are blocked and no blind retry occurs.

#### Scenario: Verified completed group
- **WHEN** every original source group and expected row is present exactly once and all unrelated state is unchanged
- **THEN** the audit becomes complete and a matching retry performs no new writes.
