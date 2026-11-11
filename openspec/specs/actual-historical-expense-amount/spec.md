# actual-historical-expense-amount Specification

## Purpose
Correct an evidenced historical simple expense amount while preserving its identity and the rest of the budget.

## Requirements

### Requirement: Correct an independently evidenced historical expense amount
The adapter SHALL accept the full previous transaction, a different negative integer amount, a bank statement identifier, an explanation and either a merchant receipt identifier, a constrained installment series supported by a distinct original bank statement, or constrained recurring subscription evidence backed by two distinct statements and a service notice. In installment statement-only mode it SHALL require CLP, an absolute correction no greater than CLP 10, exact consecutive neighboring installment snapshots, a unique numbered series signature and consecutive billing months. It SHALL reject transfers, splits, reconciled or scheduled entries, ledger-owned records, mismatched identities, invalid evidence identifiers, unexpected fields, and unverified partial writes. It SHALL preserve the cleared flag and all other transaction fields.

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

#### Scenario: Recurring subscription amount correction
- **WHEN** the operator has independently verified consecutive bank statements and an authenticated service notice, the prior historical subscription matches the same account, merchant, category, notes, billing day and previous bank amount, and the CLP correction is within CLP 100 and 5 percent
- **THEN** the adapter SHALL permit an amount-only correction with the existing lease, backup, account delta and independent readback guarantees, without describing the notice as a payment receipt.

#### Scenario: Ambiguous subscription evidence
- **WHEN** evidence modes overlap, the notice or either distinct statement is invalid, the prior transaction or dates differ, or the amount delta exceeds either bound
- **THEN** the adapter SHALL reject the candidate without writing.

### Requirement: Support a provider receipt archived in Drive
The adapter SHALL allow an independently verified provider receipt identified by a Drive file ID as an exclusive alternative to the existing evidence modes. The receipt ID SHALL be valid and distinct from the bank statement ID. The operator SHALL independently inspect the receipt and bank statement to verify the transaction identity, card, date, merchant and amount. All existing safeguards and constraints for historical amount corrections SHALL remain in force.

#### Scenario: Provider receipt and statement agree
- **WHEN** the operator has verified the provider receipt and distinct bank statement establish the same transaction and corrected amount
- **THEN** the adapter SHALL permit the existing preview and audited amount-only correction workflow.

#### Scenario: Ambiguous or invalid evidence
- **WHEN** the provider receipt ID is invalid, equals the statement ID, or another evidence mode is also supplied
- **THEN** the adapter SHALL reject the candidate without writing.

### Requirement: Correct a narrowly evidenced historical YNABEXP authorization
The adapter SHALL accept an exclusive imported-authorization evidence mode for a unique historical `YNABEXP:` simple expense when the operator has independently read a bank statement, initial bank notice, original order, and final goods receipt and confirmed they identify the same transaction and card. It SHALL require three distinct valid Gmail message identifiers, a distinctive receipt number, whole-peso CLP amounts, a correction no larger than CLP 500 and five percent of the original amount, and a bank amount within CLP 1 of final goods plus the documented service amount. The receipt number SHALL already be present in the old notes unless an explicit alternative legacy-note identity is supplied and all conditions below are met. For that alternative the original note SHALL start with the documented merchant and contain the recognized original order/receipt/bank and CLI provenance markers; the historical and current payee names SHALL match a nontrivial leading part of the merchant. The authorization amount SHALL uniquely identify one transaction on its account and date, and no other simple transaction on that account within three days SHALL equal the final amount. The import ID SHALL be unique in the budget and preserved exactly along with every field other than amount. All existing ledger, concurrency, backup and independent verification protections SHALL apply. The operator SHALL describe the service estimate and any unexplained peso and SHALL NOT treat source IDs or note markers as proof of source content.

#### Scenario: Imported authorization settled at a different amount
- **WHEN** an independently verified transaction, original order and notice, final goods receipt and bank statement satisfy all conditions
- **THEN** preview SHALL expose the correction and commit SHALL modify only the amount while preserving the imported ID and other budget data.

#### Scenario: Unique legacy authorization without receipt number in notes
- **WHEN** the operator has inspected all sources, the original note contains the required merchant and provenance, the unique account/date/amount match and no competing settled charge are verified, and all amount bounds hold
- **THEN** the adapter SHALL permit the amount-only correction while preserving the original note and import identity.

#### Scenario: Conflicting provenance or totals
- **WHEN** source identifiers overlap or are invalid, the import identity is invalid or duplicated, neither identity mode is proven, the authorization or final charge is ambiguous, totals are outside bounds, or other evidence modes are supplied
- **THEN** the adapter SHALL reject the candidate without writing.

#### Scenario: Interrupted or repeated correction
- **WHEN** the exact correction already has a completed audit
- **THEN** it SHALL verify without writing; an unaudited prior write or changed snapshot SHALL stop for inspection.

### Requirement: Verify a completed installment amount through later audit lineage
For an exact previously completed installment amount candidate backed by a statement series or identified by `#cuotas` in its original note, the adapter SHALL accept the target and any saved neighbors only when each current snapshot equals its saved snapshot or is reachable by a unique, strictly later sequence of completed, backed-up, verified per-transaction amount or date corrections with exact full snapshots and matching currency and identity. Each transition SHALL change only the field specified in its audit. This applies only to a read-only retry; a new write SHALL continue requiring exact current snapshots. Pending, ambiguous, unaudited or otherwise changed data SHALL be rejected.

#### Scenario: Amount then audited date change
- **WHEN** the identical completed amount correction is retried and a subsequent completed date audit exactly connects the verified amount snapshot to the current target
- **THEN** verification returns existing without a write.

#### Scenario: Neighbor has a subsequent verified correction
- **WHEN** a saved neighbor reaches its current snapshot through exact later completed date or amount audits
- **THEN** the adapter accepts that neighbor on the read-only retry.

#### Scenario: History does not prove the change
- **WHEN** the chain contains a pending link, timestamp conflict, mismatching full snapshot, different currency or unapproved field change
- **THEN** the adapter rejects without a write.
