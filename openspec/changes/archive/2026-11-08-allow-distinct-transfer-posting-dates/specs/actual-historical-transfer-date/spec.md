## ADDED Requirements

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
