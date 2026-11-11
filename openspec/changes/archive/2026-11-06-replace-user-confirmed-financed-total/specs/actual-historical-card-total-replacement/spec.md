## MODIFIED Requirements

### Requirement: Require complete, exact evidence before replacement

The adapter SHALL accept only one exact, simple, uncategorized-or-categorized historical purchase that is not reconciled, cleared, scheduled, a transfer, or owned by an existing source ledger. It SHALL require an active on-budget card account, original purchase evidence or specific direct user confirmation, an existing payee and at least two distinct, consecutive, already billed installments. Each installment SHALL have a unique stable source identifier, a distinct inspected statement identifier, billing date, sequence number and exact negative amount; their sum MUST equal the historical purchase amount unless a separately evidenced financed difference is explicitly declared and validated. The operator MUST independently check the statements and the purchase document or specific user confirmation identify the same transaction. Conflicts, partial series, possible duplicates, unexpected data or unavailable evidence SHALL prevent writes.

#### Scenario: Exact full series
- **WHEN** a complete evidenced series matches an unchanged, unowned historical total and no matching installments exist
- **THEN** preview proposes replacing the total with that series without modifying the budget.

#### Scenario: Incomplete or conflicting evidence
- **WHEN** a statement, number, amount, source, account, category, transaction identity or ledger state is inconsistent
- **THEN** preview and commit refuse to change the budget.

### Requirement: Require explicit evidence of financed charges and a linked Drive receipt

The adapter SHALL accept a financed replacement only when a positive integer financing cost and either a stable Drive purchase receipt identity or a specifically referenced, affirmative direct user confirmation are explicitly bound to the exact original transaction and account, purchase date, purchase amount, card suffix and installment count. All monthly statements SHALL be unique and billed and the installment total SHALL equal original price plus the declared financing cost. The operator MUST inspect the receipt or actual user confirmation and all statements and confirm identity, account, fees and payment; a declaration alone does not prove them. Each resulting installment keeps the original expense category and its note SHALL explain the financed difference is included in the series and not allocated per installment. No original total SHALL be retained as an extra expense. Existing Gmail-only exact-total operations remain unchanged.

#### Scenario: Financed card purchase with Drive receipt
- **WHEN** a verified receipt and complete bank statements establish a purchase and the stated higher total
- **THEN** preview proposes the replacement with exact financed difference and commit verifies the expected account balance change.

#### Scenario: Financed purchase confirmed by user
- **WHEN** the user specifically confirms that the unchanged historical purchase is the one shown in the complete billed statements and all identity and amount checks pass
- **THEN** preview proposes replacing it with the evidenced series and preserves the confirmation reference in the audit.

#### Scenario: Unsupported financial difference or partial series
- **WHEN** the difference, card, receipt or confirmation, original identity, amounts or a billed statement is missing, inconsistent or duplicated
- **THEN** the adapter refuses the operation before any mutation.
