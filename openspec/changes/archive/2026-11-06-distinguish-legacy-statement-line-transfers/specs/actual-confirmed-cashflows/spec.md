## MODIFIED Requirements

### Requirement: Preview verified cashflows
The adapter SHALL require an explicit currency, account identity, date, integer amount, stable unique source, corroborating evidence and complete source links. Own-account transfers SHALL identify both active accounts in the same budget and be supported by both origin and destination evidence. It SHALL reject ambiguous matches, unsupported currency, existing or potentially duplicate entries and mixed operation fields, except for an explicitly evidenced distinct transfer whose exact existing reciprocal pair has a different origin account and the same destination, date and amount, and whose separate origin receipts and shared destination statement have been reviewed; or a separately evidenced line-of-credit transfer with an exact historical income or reciprocal historical transfer identified as the sole conflicting movement on a distinct statement date.

#### Scenario: Transfer preview
- **WHEN** a uniquely verified own-account transfer has no candidate match on either side
- **THEN** preview proposes one native linked transfer without writing.

#### Scenario: Distinct transfers with identical destination and amount
- **WHEN** the candidate names the only matching destination leg and its reciprocal origin leg, a different origin, a separately identified existing-origin receipt, and a verified statement containing both deposits
- **THEN** preview may propose the new transfer while preserving the existing pair and all source identities.

#### Scenario: Unexplained additional match or conflict
- **WHEN** any matching transaction is not the identified pair, evidence overlaps or is missing, the origins coincide, the links are not reciprocal, or a new source conflicts with an existing one
- **THEN** the candidate remains in review without a financial write.


#### Scenario: Distinct line transfer and legacy match
- **WHEN** the operator has independently reviewed a shared statement and a separate receipt establishing the historical income or reciprocal card-payment transfer as a different dated row of the same amount, and provides exact snapshots for every relevant legacy leg
- **THEN** the adapter SHALL permit only that line transfer if it covers the entire conflict set, preserves all historical legs, and otherwise satisfies source, backup, lease and independent readback controls.

#### Scenario: Changed legacy match or unsupported conflict
- **WHEN** a legacy snapshot, linked leg, receipt, statement date, sign, account or conflict set disagrees
- **THEN** the adapter SHALL return review without writing.

