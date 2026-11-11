## ADDED Requirements

### Requirement: Distinguish a verified same-value transfer from another origin
The adapter SHALL allow an explicitly documented list of equal-value reciprocal transfer peers from distinct origins to the same destination only when the operator independently verifies distinct provider receipts and statement evidence. Each peer SHALL contain exact current snapshots of both reciprocal legs, a distinct receipt and explanatory evidence. The declared peer destinations SHALL cover exactly every colliding transfer in the existing date window. The adapter SHALL reject omitted, extra, duplicated, changed, nonreciprocal, same-origin, unverified or ambiguous peers. Planning SHALL bind the complete candidate, peer snapshots and ledger, and independent verification SHALL prove that peers and unrelated data remain unchanged.

#### Scenario: Two verified transfers to the same destination
- **WHEN** exact peer snapshots and distinct receipts identify two same-value transfers from different origins and both destination credits appear in the statement
- **THEN** the adapter previews only the targeted date correction and preserves the other transfer unchanged.

#### Scenario: Missing or invalid peer
- **WHEN** any collision is undeclared, a peer is stale or unrelated, receipts are not distinct, or the statement does not support separate transfers
- **THEN** the operation refuses to write.
