## Purpose

Represent confirmed card refinancing and billed installments while preserving historical spending and separating principal from finance costs.

## ADDED Requirements

### Requirement: Evidence-backed refinancing ledger
The adapter SHALL preview and record a refinancing only when the original debt, card, currency, contract, date, and each posted installment have individually identifiable evidence and internally consistent amounts. It SHALL label amortization inferred from statements as inferred, and SHALL keep unresolved differences and future reminders in review.

#### Scenario: Billed installment with supported allocation
- **WHEN** the operator supplies a reviewed opening principal, statement-backed billed amount, principal and interest, and the source-backed calculation and consecutive balances reconcile exactly
- **THEN** the preview shows the inferred allocation and a posting transfers principal between the card and a dedicated debt account while categorizing interest separately.

#### Scenario: Unsupported or contradictory data
- **WHEN** an allocation does not reconcile, a relevant cutoff has unexplained competing balances, the evidence is incomplete, or an installment already exists without matching audit
- **THEN** the adapter SHALL refuse the affected write and retain the source in review.

### Requirement: No duplicated principal or unrelated changes
The adapter SHALL account for the original refinancing credit as a transfer to a distinct on-budget debt account and SHALL preserve existing purchases, payments, future non-posting reminders, unrelated accounts, and checkpoints. The debt account represents outstanding principal and SHALL not include unearned future interest.

#### Scenario: Posting history
- **WHEN** the opening refinancing and billed installments are posted
- **THEN** the card receives the documented credit and the billed amounts, the debt balance changes only by principal, and categorized expenses increase only by the supported interest.

#### Scenario: Future installments
- **WHEN** later installments have not yet been billed
- **THEN** the operation SHALL NOT create posted expenses or mark their reminders paid.

### Requirement: Audited and recoverable writes
The adapter SHALL require its own live lease, exclusive lock, preview, backup, revalidation, synchronization, independent readback, durable audit, and deterministic identities. An interrupted or partially applied operation SHALL halt for evidence-based recovery rather than repeating any financial write.

#### Scenario: Successful execution and exact retry
- **WHEN** execution completes and the same candidate is retried
- **THEN** independent readback confirms all intended entries, balances and preserved data, and the retry adds nothing.

#### Scenario: Interrupted execution
- **WHEN** only a subset of the intended writes exists without a matching complete audit
- **THEN** the adapter stops and identifies the existing items for manual recovery without changing the source identities.
