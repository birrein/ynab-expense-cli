## ADDED Requirements

### Requirement: Correct a narrowly evidenced historical YNABEXP authorization
The adapter SHALL accept an exclusive imported-authorization evidence mode for a unique historical `YNABEXP:` simple expense when the operator has independently read a bank statement, initial bank notice, original order, and final goods receipt and confirmed they identify the same transaction and card. It SHALL require three distinct valid Gmail message identifiers, a distinctive receipt number already present in the old notes, whole-peso CLP amounts, a correction no larger than CLP 500 and five percent of the original amount, and a bank amount within CLP 1 of final goods plus the documented service amount. The import ID SHALL be unique in the budget and preserved exactly along with every field other than amount. All existing ledger, concurrency, backup and independent verification protections SHALL apply. The operator SHALL describe the service estimate and any unexplained peso and SHALL NOT treat source IDs as proof of source content.

#### Scenario: Imported authorization settled at a different amount
- **WHEN** an independently verified transaction, original order and notice, final goods receipt and bank statement satisfy all conditions
- **THEN** preview SHALL expose the correction and commit SHALL modify only the amount while preserving the imported ID and other budget data.

#### Scenario: Conflicting provenance or totals
- **WHEN** source identifiers overlap or are invalid, the imported ID is not unique or not a YNABEXP ID, receipt number does not match, totals are outside bounds, or other evidence modes are supplied
- **THEN** the adapter SHALL reject the candidate without writing.

#### Scenario: Interrupted or repeated correction
- **WHEN** the exact correction already has a completed audit
- **THEN** it SHALL verify without writing; an unaudited prior write or changed snapshot SHALL stop for inspection.
