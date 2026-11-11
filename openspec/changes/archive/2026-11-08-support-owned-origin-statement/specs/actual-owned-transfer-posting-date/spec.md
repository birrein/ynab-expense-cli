## MODIFIED Requirements

### Requirement: Correct one owned transfer posting date safely
The adapter SHALL accept exact snapshots of both reciprocal unreconciled simple transfer legs and their unchanged verified original cashflow ledger, a source receipt and two distinct independently inspected statements. It SHALL require active accounts, unique ownership, no conflicting nearby transfers, and an origin posting date one to four days after the unchanged destination date. The original receipt and at least one of the two supplied statements SHALL match recorded evidence. It SHALL preview a hash of all relevant data and daily balances; preserve both IDs, links, notes, sources, amounts, other fields, balances and ledger; back up and revalidate under lease; persist pending audit before writing; and independently verify the entire state before completion.

#### Scenario: Unique transfer with later origin posting
- **WHEN** verified source, snapshots, receipt and distinct statements uniquely establish the origin posting and unchanged destination
- **THEN** preview proposes the single date correction, which apply verifies without creating a transfer.

#### Scenario: Original origin statement
- **WHEN** the original verified cashflow cites the origin statement and receipt, and the operator independently inspects a distinct destination statement
- **THEN** the transfer remains eligible under all other correction controls.

#### Scenario: Conflicting or unverified evidence
- **WHEN** ownership, snapshot, evidence, account, date, reciprocal linkage or a nearby same-value movement conflicts, or neither statement is an original source
- **THEN** the adapter refuses any mutation.

#### Scenario: Interrupted or repeated update
- **WHEN** update or verification is interrupted after pending intent
- **THEN** pending audit blocks subsequent financial mutation; an exact completed retry verifies without a write.
