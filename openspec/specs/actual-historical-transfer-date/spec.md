# actual-historical-transfer-date Specification

## Purpose
Correct an evidenced date of a historical linked own-account transfer without creating another transaction.

## Requirements

### Requirement: Correct both legs of an evidenced transfer date
The adapter SHALL require exact full snapshots of reciprocal simple unreconciled unowned legs, active accounts, independently reviewed receipt and statement, and an unambiguous correction of exactly one day within the same month. As an explicit alternative for a posting-date difference across a month boundary, it SHALL require a receipt, distinct origin and destination bank statement identifiers, a posting date equal to the existing date, and an operation date one to four calendar days earlier in the immediately preceding month. As another explicit alternative within the same month, it SHALL require a destination receipt, an origin statement, receipt and statement operation dates equal to the proposed date, and an existing date two to four days later. The operator SHALL independently verify the origin statement and destination receipt identify the same card, destination, date and amount, check both accounts for competing transfers, and examine destination statements if available. It SHALL preserve both IDs, all non-date fields, cleared flags, account balances and unrelated data.

#### Scenario: Exact proven payment
- **WHEN** both legs, accounts, amounts, date and inspected evidence match with no competing pair
- **THEN** preview proposes updating both dates without creating a transfer.

#### Scenario: Missing evidence or conflicting pair
- **WHEN** a snapshot, statement, receipt, account, date or nearby match conflicts
- **THEN** the operation fails without writing.

#### Scenario: Cross-month bank posting delay
- **WHEN** two independently inspected distinct statements and a payment receipt establish the same transfer, its earlier operation date is at most four days before the old posting date across the month boundary, and no competing pair exists
- **THEN** preview SHALL propose changing both existing legs to the evidenced operation date under the existing audited workflow.

#### Scenario: Invalid posting evidence
- **WHEN** statement identifiers are invalid or identical, the supplied posting date differs from the existing date, dates are not in adjacent months, the operation is later, or the difference exceeds four days
- **THEN** the operation SHALL stop without writing.

#### Scenario: Same-month delay supported at both ends
- **WHEN** a destination receipt and origin statement independently identify one transfer on the same date and the existing pair is dated two to four days later within that month with no competing pair
- **THEN** preview SHALL propose changing both existing dates without a new transfer.

#### Scenario: Same-month date evidence invalid
- **WHEN** the receipt or statement date differs from the proposed date, the existing date is earlier, the gap is outside two to four days, the month differs, both evidence modes are supplied, or other validation fails
- **THEN** the operation SHALL stop without writing.

### Requirement: Audit interrupted and completed updates
The adapter SHALL back up, revalidate and persist a pending audit before updating; it SHALL independently verify the full result before completing the audit. A pending audit SHALL block retries and an identical complete retry SHALL only verify.

#### Scenario: Interrupted update
- **WHEN** either update or readback fails
- **THEN** the pending audit and backup remain available and subsequent automatic mutation is blocked.

### Requirement: Preserve different independently evidenced posting dates
The adapter SHALL support updating exactly one leg of an existing reciprocal historical own-account transfer to its statement posting date while preserving the other leg's independently evidenced posting date. It SHALL require exact full snapshots, active accounts, no reconciliation, no owned source or competing transfer, a payment receipt, two distinct bank statement identifiers, operator-reviewed identity and dates, and a difference of no more than four days. It SHALL preserve both IDs, transfer links, amounts, accounts, cleared flags, all unrelated budget state and final balances. It SHALL validate daily balances around both dates, preview an immutable hash, require a lease and matching hash, back up, revalidate, and persist a pending audit before writing; only a fresh independent full readback may mark the audit complete. Pending intent SHALL block further financial mutations; a complete identical retry SHALL only verify.

#### Scenario: Different dates on the two statements
- **WHEN** both statements and a receipt uniquely identify the same existing transfer with one wrong leg date
- **THEN** preview proposes the single correction and apply verifies both dates and preserved linkage without creating a transaction.

#### Scenario: Conflicting, incomplete or ambiguous evidence
- **WHEN** snapshots, account, dates, statements, receipt, ownership or nearby matches conflict
- **THEN** the adapter refuses to write.

#### Scenario: Interrupted update
- **WHEN** update or independent verification fails after intent is persisted
- **THEN** the pending audit and backup remain and subsequent financial mutations are blocked.

### Requirement: Align both transfer legs to a later common statement date
The adapter SHALL support changing both legs of one reciprocal historical transfer from the same receipt date to the same later posting date when the operator independently verifies the receipt and both distinct bank statements. The posting date SHALL be one to four calendar days later. The adapter SHALL require exact snapshots, active accounts, no conflicting source ownership or nearby competitors, and a hash-bound plan showing daily effects. It SHALL preserve IDs, amounts, payees, linkage, cleared states, unrelated data and final balances. A backup and durable pending audit SHALL precede either write. Both posting dates and full state SHALL be checked by an independent download before completing the audit; an interrupted operation SHALL block further financial mutations until investigated. An exact completed retry SHALL verify without writing.

#### Scenario: Matching bank postings
- **WHEN** two independently reviewed statements identify the same later posting date and the receipt identifies the original transfer
- **THEN** preview proposes changing both dates with daily effects and application verifies the existing reciprocal pair without creating another transaction.

#### Scenario: Divergent or incomplete evidence
- **WHEN** either statement date differs, a receipt or statement is missing, the date gap exceeds four days, the snapshots changed or a competing transfer exists
- **THEN** the operation refuses to write.

#### Scenario: Partial update
- **WHEN** either write or independent verification fails after the audit begins
- **THEN** the audit remains pending and further automatic financial mutations are blocked.

### Requirement: Preserve a superseded transfer-date audit
The adapter SHALL allow a statement-backed one-leg posting-date correction after a completed historical transfer-date correction only with explicit linkage to that exact completed audit, full snapshots matching the previous verified outcome, independent receipt and distinct origin and destination statements, and all existing posting-date controls. It SHALL preserve the previous audit unchanged and create a separate pending and completed audit. A repeat verification of the previous correction SHALL accept the new state only if a complete matching linked posting-date audit proves the exact subsequent state. Pending, absent, mismatched or unrelated audit chains SHALL never authorize a write or a successful repeat verification.

#### Scenario: Exact complete history
- **WHEN** the prior complete audit, snapshots, independent evidence and posting-date plan match
- **THEN** the adapter updates the evidenced single leg and both audits can subsequently be verified without rewriting.

#### Scenario: Unlinked or interrupted history
- **WHEN** the previous audit is absent or pending, snapshots do not match its result, or the subsequent audit is pending or mismatched
- **THEN** the adapter refuses the operation or repeat verification without making a financial write.

### Requirement: Distinguish a verified same-value transfer from another origin
The adapter SHALL allow an explicitly documented list of equal-value reciprocal transfer peers from distinct origins to the same destination only when the operator independently verifies distinct provider receipts and statement evidence. Each peer SHALL contain exact current snapshots of both reciprocal legs, a distinct receipt and explanatory evidence. The declared peer destinations SHALL cover exactly every colliding transfer in the existing date window. The adapter SHALL reject omitted, extra, duplicated, changed, nonreciprocal, same-origin, unverified or ambiguous peers. Planning SHALL bind the complete candidate, peer snapshots and ledger, and independent verification SHALL prove that peers and unrelated data remain unchanged.

#### Scenario: Two verified transfers to the same destination
- **WHEN** exact peer snapshots and distinct receipts identify two same-value transfers from different origins and both destination credits appear in the statement
- **THEN** the adapter previews only the targeted date correction and preserves the other transfer unchanged.

#### Scenario: Missing or invalid peer
- **WHEN** any collision is undeclared, a peer is stale or unrelated, receipts are not distinct, or the statement does not support separate transfers
- **THEN** the operation refuses to write.

### Requirement: Correct a manually entered transfer date from matching evidence
The adapter SHALL allow an explicitly selected correction of both legs of a reciprocal eligible historical transfer by one to seven days forward when the independent receipt and both distinct complete statements agree on the same new date, source and destination accounts and amount. It SHALL reject competing same-amount transfers near either date, stale snapshots, conflicting or owned sources and absent evidence. All existing full-budget, daily-balance, lease, backup, pending-audit and independent readback protections SHALL apply.

#### Scenario: Two statements and a receipt identify the correct date
- **WHEN** both account statements and the receipt identify the same transfer on a date six days after its manual date
- **THEN** the adapter previews and verifies both dates without creating a transfer.

#### Scenario: Conflicting proof or competing transfer
- **WHEN** the receipt or statements disagree, a competing transfer exists, the mode is absent or any other control fails
- **THEN** no write is permitted.

### Requirement: Correct the origin date using a distinct destination issuer receipt
The adapter SHALL allow the operator to substitute an independently inspected destination issuer receipt for the destination statement only when correcting the origin date of a simple existing reciprocal transfer. It SHALL require a distinct source-bank receipt, the complete origin statement, an explicit destination receipt ID and date equal to the unchanged destination date, and a gap of at most four days. Both source IDs SHALL be unowned and not attached to another transaction or audit. The operator SHALL verify both receipts, accounts, amount, destination posting semantics and lack of competing transfers. Existing full snapshots, preview hash, lease, backup, pending-audit and independent full-budget verification requirements SHALL remain in force.

#### Scenario: Issuer receipt and bank statement establish dates
- **WHEN** the source receipt and statement establish the origin posting and the distinct destination issuer receipt establishes the unchanged destination posting
- **THEN** only the origin date is updated and the existing pair is independently verified.

#### Scenario: Missing or conflicting evidence
- **WHEN** either receipt is missing, reused, owned, inconsistent, the destination date changes, the issuer date differs, or a competing payment exists
- **THEN** no mutation is allowed.

### Requirement: Align a transfer when the receipt predates the historical date
The adapter SHALL allow an explicitly selected correction of both legs of an eligible reciprocal historical transfer when the operator independently verifies a payment receipt dated exactly one day before the shared historical date and two distinct complete account statements show the same later posting date. The posting date SHALL be after the historical date and no more than four days after the receipt. The operator SHALL inspect the receipt, both account statements and competing transactions and verify holder, origin, destination, amount, operation and postings. The adapter SHALL reject combination with other exception modes, ambiguous same-value transfers near the receipt, original or posting dates, and all source or snapshot conflicts. The existing hash-bound plan, balance, lease, lock, backup, pending-audit, independent full-budget readback and retry protections SHALL remain mandatory.

#### Scenario: Receipt one day before a historical date
- **WHEN** a receipt dated one day before an eligible historical pair and distinct statements identify one transfer with common posting no more than four days after the receipt
- **THEN** the adapter previews and verifies only both existing dates without creating a transfer.

#### Scenario: Evidence conflict or nearby competitor
- **WHEN** either date gap, receipt, statement, snapshot, source, mode or nearby equal-value transfer conflicts
- **THEN** the adapter refuses the mutation.
