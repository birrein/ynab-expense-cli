## MODIFIED Requirements

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
