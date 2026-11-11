# actual-partial-uber-cash-reconstruction Specification

## Purpose
Represent a documented card charge refunded to a merchant wallet and later verified wallet-funded rides without inventing an opening balance or duplicating a mixed payment.

## Requirements

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

### Requirement: Verify a completed reconstruction after subsequent wallet movements
A retry of an already completed reconstruction SHALL verify its exact original transaction identities, reciprocal transfer, source details, categories, notes, account metadata and shared card ledger without requiring the present wallet balance to equal the balance at the original reconstruction. The initial write SHALL still verify the complete budget and exact expected balance before completing the audit.

#### Scenario: A later legitimate wallet transaction
- **WHEN** an unrelated later wallet transaction changes the current wallet balance while all originally audited rows and shared card source remain exact
- **THEN** a completed retry SHALL verify read-only without failing due to the new balance.

#### Scenario: An audited row changes
- **WHEN** an originally audited transaction, counterpart, source, account or shared card ledger is missing, duplicated or changed
- **THEN** the retry SHALL fail without writing.

### Requirement: Add an independently evidenced missing mixed-payment component
The adapter SHALL accept a clearly identified existing partial Uber Cash wallet, the exact already-registered card transaction and source ledger record, a shared receipt, statement evidence, the receipt total and missing wallet amount. The existing card and wallet amounts SHALL sum exactly to the receipt total. The operator SHALL independently inspect the complete receipt and statement, transaction and source history and possible duplicates before planning. The adapter SHALL reserve the shared receipt, preserve the card transaction and source ledger exactly, and create only the missing wallet expense. It SHALL use an owned lease and lock, full-budget and stable-ledger plan digest, backup, revalidation, durable pending audit, independent readback and complete unrelated-data and balance comparison. An interruption SHALL block other financial writes pending investigation. An exact completed retry SHALL verify read-only and tolerate later unrelated wallet entries.

#### Scenario: Existing card source is shared with wallet component
- **WHEN** the receipt and statement support a single mixed payment and its card part already exists once
- **THEN** only the wallet part SHALL be created, linked to the same receipt through a durable audit, without replacing the existing source or adding the receipt total.

#### Scenario: Ambiguous source or stale state
- **WHEN** the source, total, ledger, duplicate checks or budget differs from the reviewed plan
- **THEN** the adapter SHALL stop without writing.

#### Scenario: Interrupted write
- **WHEN** the operation fails after persisting its intent
- **THEN** the audit SHALL remain pending and financial writes SHALL be blocked until investigated.

### Requirement: Accept evidenced Uber Eats mixed payments
The adapter SHALL accept a previously recorded Uber Eats card component with an existing Eating Out & Delivery category when the complete receipt and statement prove a mixed card and Uber Cash order. All source ownership, exact total, duplicate prevention, lease, digest, backup, audit, independent readback and partial-balance requirements for mixed components SHALL continue to apply. It SHALL reject mismatched payee-category pairs and SHALL NOT apply this exception to unknown merchants or categories.

#### Scenario: Uber Eats order with matching dining category
- **WHEN** the card component and ledger are verified as Uber Eats in Eating Out & Delivery and a receipt confirms the missing wallet component
- **THEN** only the evidenced wallet component SHALL be added with the same dining category and grouped with the original receipt.

#### Scenario: Conflicting category
- **WHEN** the card component's payee or category does not match either the supported Uber ride or Uber Eats order pairing
- **THEN** the operation SHALL stop without writing.

### Requirement: Preserve mixed-payment audit while correcting a card note
The adapter SHALL permit an explicitly evidenced literal text correction on the card row of a completed mixed-payment group while preserving its original audit and source record. It SHALL protect links, tags, source metadata and every field other than the selected note text, require an exact complete original group, full snapshot and ledger plan digest, owned lease and lock, backup, revalidation and durable pending amendment intent, and independently verify the entire budget before completing the amendment. Any pending intent SHALL block other financial writes. A subsequent original-group retry SHALL accept the changed note only through the exact complete amendment audit and otherwise fail without writing.

#### Scenario: Card note correctly amended
- **WHEN** the original group and note match, and the requested replacement does not intersect source metadata or tags
- **THEN** only that note text SHALL change, with an independently verified amendment audit that preserves both wallet and card components.

#### Scenario: Interrupted or unverified amendment
- **WHEN** the amendment is pending, the original group changed, or the amendment audit is absent or altered
- **THEN** the operation SHALL fail closed without further financial writes.

### Requirement: Reconstruct a mixed wallet component of an existing categorized split
For an evidenced Uber Eats order whose existing card component is a verified split between groceries and alcohol, the adapter SHALL accept the exact parent, children and original Gmail ledger snapshot, receipt and card statement, both payment amounts and category subtotals. The operator SHALL inspect the complete receipt and existing entries. It SHALL compute the category allocation for the entire order by proportional largest-remainder rounding and create only the wallet split whose children are the difference between that allocation and the existing card children. It SHALL preserve the original parent, child rows, source ledger, categories and shared receipt identity, require an owned lease, lock, full-budget and stable-ledger digest, backup, pending intent, and independent full readback. Pending intent SHALL block other financial writes; completed exact retries SHALL verify without writing while tolerating unrelated later wallet entries.

#### Scenario: Verified grocery and alcohol order
- **WHEN** card and wallet portions sum to the order, the original split and ledger match, and category weights are supported by the complete receipt
- **THEN** the adapter SHALL create exactly one wallet parent with category children equal to the proportional full-order allocation less the existing card categories.

#### Scenario: Conflicting amounts, sources or state
- **WHEN** any child, source ownership, total, category, source evidence, potential duplicate or plan snapshot conflicts
- **THEN** it SHALL stop without writing and SHALL NOT invent a different source identity.
