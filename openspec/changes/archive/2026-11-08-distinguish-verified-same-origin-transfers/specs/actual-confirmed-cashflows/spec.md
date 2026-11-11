## MODIFIED Requirements

### Requirement: Preview verified cashflows
The adapter SHALL require an explicit currency, account identity, date, integer amount, stable unique source, corroborating evidence and complete source links. Own-account transfers SHALL identify both active accounts in the same budget and be supported by both origin and destination evidence. It SHALL reject ambiguous matches, unsupported currency, existing or potentially duplicate entries and mixed operation fields, except for an explicitly evidenced distinct transfer whose exact existing reciprocal pair has a different origin account and the same destination, date and amount, and whose separate origin receipts and shared destination statement have been reviewed; or an independently inspected distinct interest-income row and its complete set of nearby, separately sourced and already verified ledger matches; or a separately evidenced line-of-credit transfer with an exact historical income or reciprocal historical transfer identified as the sole conflicting movement on a distinct statement date; or a differently dated, separately evidenced repayment of the same line whose only conflicting pair is already verified in the cashflow ledger; or the exact historical same-origin pair of the same amount within four days to a different destination, with distinct rows and recipient evidence independently inspected; or an exact verified cashflow-owned pair of the same amount within four days to a different destination, with a shared origin statement, distinct recipient evidence and prior source independently verified.

#### Scenario: Transfer preview
- **WHEN** a uniquely verified own-account transfer has no candidate match on either side
- **THEN** preview proposes one native linked transfer without writing.

#### Scenario: Distinct transfers with identical destination and amount
- **WHEN** the candidate names the only matching destination leg and its reciprocal origin leg, a different origin, a separately identified existing-origin receipt, and a verified statement containing both deposits
- **THEN** preview may propose the new transfer while preserving the existing pair and all source identities.

#### Scenario: Unexplained additional match or conflict
- **WHEN** any matching transaction is not the identified pair, evidence overlaps or is missing, same-origin evidence is insufficient, the links are not reciprocal, or a new source conflicts with an existing one
- **THEN** the candidate remains in review without a financial write.

#### Scenario: Distinct line transfer and legacy match
- **WHEN** the operator has independently reviewed a shared statement and a separate receipt establishing the historical income or reciprocal card-payment transfer as a different dated row of the same amount, and provides exact snapshots for every relevant legacy leg
- **THEN** the adapter SHALL permit only that line transfer if it covers the entire conflict set, preserves all historical legs, and otherwise satisfies source, backup, lease and independent readback controls.

#### Scenario: Changed legacy match or unsupported conflict
- **WHEN** a legacy snapshot, linked leg, receipt, statement date, sign, account or conflict set disagrees
- **THEN** the adapter SHALL return review without writing.

#### Scenario: Distinct repayments to the same line
- **WHEN** the operator inspects a shared statement showing distinct dated repayment rows and identifies the sole nearby conflict as an exact verified reciprocal pair for the same origin, destination and amount
- **THEN** the adapter SHALL permit the new repayment only with exact snapshots, distinct sources, prior ledger verification, complete conflict coverage, backup, lease and independent readback.

#### Scenario: Unverified or incomplete prior repayment
- **WHEN** any prior snapshot, ledger source, date, amount, account, reciprocity, statement or conflict set disagrees
- **THEN** the adapter SHALL return review without writing.

#### Scenario: Same origin, distinct destinations and same amount
- **WHEN** the operator independently verifies two distinct statement rows within four days, the new recipient report and exact snapshots of the sole conflicting historical reciprocal transfer to a different account
- **THEN** the adapter SHALL permit the separately sourced new transfer while preserving the existing pair, and shall revalidate, back up, audit and independently verify all effects.

#### Scenario: Unidentified same-origin conflict
- **WHEN** snapshots, reciprocal payees, source, date, distinct descriptors or conflict coverage differ, or supporting statement and recipient documents are missing
- **THEN** the adapter SHALL return review without a financial write.

#### Scenario: Distinct nearby interest credits
- **WHEN** each nearby equal-amount income is covered by an exact snapshot and a separately verified ledger source on an independently inspected statement, with a distinct date and reference from the new statement row
- **THEN** preview may propose the new income while retaining all other controls; execution records a pending source reservation before writing and completes it only after independent readback.

#### Scenario: Missing or changed interest evidence
- **WHEN** any reference, identity, date, ledger record, account, category, statement or conflict set is missing, changed or ambiguous
- **THEN** the adapter refuses to write.

#### Scenario: Interrupted or completed interest operation
- **WHEN** the operation is interrupted after recording its intent
- **THEN** all routes reject reuse of its sources until investigation; a completed exact retry verifies its ledger and audit without further writes.


#### Scenario: Verified same-origin prior transfer
- **WHEN** a shared origin statement shows two distinct rows and the only nearby conflict is an exact reciprocal pair to another active account, verified in the cashflow ledger with its distinct source and receipt, and the new recipient statement is independently verified
- **THEN** the adapter SHALL permit the new transfer with lease, backup, audit and independent readback, preserving the prior pair and all sources.

#### Scenario: Invalid verified same-origin evidence
- **WHEN** the ledger, snapshots, sources, dates, destinations, descriptors or conflict coverage disagree
- **THEN** the adapter SHALL return review without writing.
