## MODIFIED Requirements

### Requirement: Correct a uniquely evidenced historical installment date
The adapter SHALL accept only an exact, simple, unreconciled, unscheduled historical installment absent from source-ledger ownership, with original purchase evidence from either a merchant Gmail message or a distinct original bank statement, the billing statement and exact neighboring installments in the same series. It SHALL preserve the transaction ID, amount, payee, category, notes, other installments and total balances. For the final installment of a series with at least three installments, it SHALL accept the two preceding installments as neighbors, with consecutive installment numbers and billing months.

#### Scenario: Matching installment
- **WHEN** the statement identifies a unique billed installment, the exact original matches, adjacent numbered installments confirm the series, and the target date lies in the correct billing sequence
- **THEN** preview proposes changing only its date and a verified commit changes only that field.

#### Scenario: Final installment
- **WHEN** the final installment has two exact preceding neighbors in consecutive months, with the same account, payee, category and normalized series identity, and its statement supports the target billing month
- **THEN** preview and commit apply the same identity, safety and independent verification checks as an intermediate installment.

#### Scenario: Conflicting identity or prior write
- **WHEN** the original, neighbor, statement, ledger ownership or duplicate detection conflicts, or the date was already changed without an exact completed audit
- **THEN** the operation SHALL stop without a new write.

#### Scenario: Original purchase statement
- **WHEN** an operator independently verifies the original purchase statement and the distinct target billing statement identify the same account, purchase, installment series and dates
- **THEN** the adapter accepts the original statement identifier in place of a Gmail purchase identifier, preserving every other safety check.

#### Scenario: Ambiguous evidence sources
- **WHEN** the original purchase identifier is missing, both source modes are supplied, or both statement identifiers are identical
- **THEN** the operation stops without a financial write.

