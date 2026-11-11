## MODIFIED Requirements

### Requirement: Correct an independently evidenced historical expense amount
The adapter SHALL accept the full previous transaction, a different negative integer amount, a bank statement identifier, an explanation and either a merchant receipt identifier or a constrained installment series supported by a distinct original bank statement. In statement-only mode it SHALL require CLP, an absolute correction no greater than CLP 10, exact consecutive neighboring installment snapshots, a unique numbered series signature and consecutive billing months. It SHALL reject transfers, splits, reconciled or scheduled entries, ledger-owned records, mismatched identities, invalid evidence identifiers, unexpected fields, and unverified partial writes. It SHALL preserve the cleared flag and all other transaction fields.

#### Scenario: Correct a cleared but unreconciled historical expense
- **WHEN** the bank statement and merchant receipt establish a corrected amount for the exact existing expense
- **THEN** preview reports the old and new amounts and commit changes only that amount and the corresponding account balance after backup and independent readback.

#### Scenario: Reject changed or unsupported state
- **WHEN** the transaction differs from the supplied snapshot, has unsupported links, or an unaudited correction is already present
- **THEN** the operation stops without another financial write.

#### Scenario: Repeat a completed correction
- **WHEN** an identical candidate has a completed audit and the independently downloaded transaction matches it exactly
- **THEN** the operation verifies the existing correction without creating a backup or writing again.

#### Scenario: Concurrent update or interrupted write
- **WHEN** the budget changes during revalidation or readback differs from the expected exact delta
- **THEN** the operation stops and retains the backup for inspection instead of retrying automatically.

#### Scenario: Bank-statement-evidenced installment rounding
- **WHEN** the operator has independently verified distinct original and target bank statements identify the same purchase and installment, the existing historical installment and exact neighboring series match, and the change is at most CLP 10
- **THEN** the adapter SHALL permit the amount-only correction with the same backup, account delta and independent readback guarantees.

#### Scenario: Conflicting evidence or installment identity
- **WHEN** both evidence modes are supplied, either statement ID is invalid or identical, neighboring series or billing months disagree, or the amount difference exceeds the limit
- **THEN** the operation SHALL stop without writing.
