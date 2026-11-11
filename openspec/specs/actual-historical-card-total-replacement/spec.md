# actual-historical-card-total-replacement Specification

## Purpose
Reconstruct historically billed card installments without duplicating a purchase total or changing unrelated financial records.

## Requirements

### Requirement: Require complete, exact evidence before replacement

The adapter SHALL accept only one exact, simple, uncategorized-or-categorized historical purchase that is not reconciled, cleared, scheduled, a transfer, or owned by an existing source ledger. It SHALL require an active on-budget card account, original purchase evidence or specific direct user confirmation, an existing payee and at least two distinct, consecutive, already billed installments. Each installment SHALL have a unique stable source identifier, a distinct inspected statement identifier, billing date, sequence number and exact negative amount; their sum MUST equal the historical purchase amount unless a separately evidenced financed difference is explicitly declared and validated. The operator MUST independently check the statements and the purchase document or specific user confirmation identify the same transaction. Conflicts, partial series, possible duplicates, unexpected data or unavailable evidence SHALL prevent writes.

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

### Requirement: Fail closed on interrupted writes

The operation SHALL require an owned lease, exclusive lock, private backup and complete revalidation before recording a pending audit and changing any financial data. It SHALL synchronize and independently read back the whole budget before marking the audit complete. A matching verified retry SHALL only verify; a pending audit, changed original, unexpected partial series or absent audit SHALL stop and require investigation without replacing source identifiers.

#### Scenario: Exact verified retry
- **WHEN** the same completed candidate is retried
- **THEN** it returns the existing verified series without creating, changing or deleting transactions.

#### Scenario: Interrupted conversion
- **WHEN** the audit is pending or the original no longer matches without a completed matching audit
- **THEN** no automatic retry or new write occurs and the backup and source identities remain available for investigation.

### Requirement: Allow explicit receipt evidence for untagged historical totals

The adapter SHALL accept an original without an installment tag only when an explicit receipt-evidence declaration binds the original transaction ID, account, purchase date and total, purchase message ID, card last four digits and installment count to the candidate. It SHALL reject missing, malformed, extra or inconsistent fields. The operator MUST independently inspect the receipt and all statements and establish that they describe the same purchase and account. The adapter SHALL preserve original notes without manufacturing a tag, and all existing series, account, ledger, duplicate, backup and verification requirements SHALL remain in force. A supplied declaration SHALL always be checked, including for tagged originals.

#### Scenario: Untagged original with complete matching receipt evidence
- **WHEN** the original is untagged and the exact declaration, inspected receipt and complete statement series match it
- **THEN** the adapter permits the normal preview and verified replacement without adding an invented tag.

#### Scenario: Absent or inconsistent declaration
- **WHEN** an untagged original has no declaration or a supplied declaration conflicts with the original or series
- **THEN** the adapter rejects the candidate before any financial write.

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
