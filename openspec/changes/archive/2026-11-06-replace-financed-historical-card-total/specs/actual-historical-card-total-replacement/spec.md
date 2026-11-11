## MODIFIED Requirements

### Requirement: Require complete, exact evidence before replacement

The adapter SHALL accept only one exact, simple, uncategorized-or-categorized historical purchase that is not reconciled, cleared, scheduled, a transfer, or owned by an existing source ledger. It SHALL require an active on-budget card account, an existing payee, original purchase evidence and at least two distinct, consecutive, already billed installments. Each installment SHALL have a unique stable source identifier, a distinct inspected statement identifier, billing date, sequence number and exact negative amount; their sum MUST equal the historical purchase amount unless a separately evidenced financed difference is explicitly declared and validated. The operator MUST independently check that each statement and purchase document refer to the same transaction. Conflicts, partial series, possible duplicates, unexpected data or unavailable evidence SHALL prevent writes.

#### Scenario: Exact full series
- **WHEN** a complete evidenced series matches an unchanged, unowned historical total and no matching installments exist
- **THEN** preview proposes replacing the total with that series without modifying the budget.

#### Scenario: Incomplete or conflicting evidence
- **WHEN** a statement, number, amount, source, account, category, transaction identity or ledger state is inconsistent
- **THEN** preview and commit refuse to change the budget.

### Requirement: Preserve identity and verify the replacement

The committed operation SHALL retain the historical transaction ID for the first billed installment, preserve its account, payee and category, and create the remaining installments with stable unique sources and evidence links. The original amount, date and notes SHALL remain available in a durable audit. The resulting installment sum and account balance SHALL differ from the original by exactly the explicitly evidenced financed cost (zero for the existing flow); all unrelated transactions, schedules, rules, balances and budget metadata SHALL remain unchanged.

#### Scenario: Successful conversion
- **WHEN** a valid preview is committed and independently verified
- **THEN** only the original total is transformed into the first installment, the other installments appear exactly once, and account totals are unchanged.


## ADDED Requirements

### Requirement: Require explicit evidence of financed charges and a linked Drive receipt

The adapter SHALL accept an optional financed replacement only when a positive integer financing cost, a stable Drive purchase receipt identity, exact original transaction and account, purchase date, purchase amount, card suffix and installment count are explicitly bound to the candidate, all monthly statements are unique and billed, and the installment total equals original price plus the declared financing cost. The operator MUST inspect the receipt and all statements and confirm identity, account, fees and payment; a receipt or declaration alone does not prove them. Each resulting installment keeps the original expense category and its note SHALL explain the financed difference is included in the series and not allocated per installment. No original total SHALL be retained as an extra expense. Existing Gmail-only exact-total operations remain unchanged.

#### Scenario: Financed card purchase with Drive receipt
- **WHEN** a verified receipt and complete bank statements establish a purchase and the stated higher total
- **THEN** preview proposes the replacement with exact financed difference and commit verifies the expected account balance change.

#### Scenario: Unsupported financial difference or partial series
- **WHEN** the difference, card, receipt, original identity, amounts or a billed statement is missing, inconsistent or duplicated
- **THEN** the adapter refuses the operation before any mutation.
