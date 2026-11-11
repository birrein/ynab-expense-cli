## ADDED Requirements

### Requirement: Create missing evidenced cashflow payees safely
For an otherwise valid, uniquely identified expense or income the adapter SHALL preview whether its exact payee exists or must be created. It SHALL reject ambiguous normalized names or transfer payees, back up and revalidate the complete budget and lease before any creation, and independently verify exactly the intended payee and movement, unchanged unrelated records, and expected balances. A retry with the same stable source SHALL never duplicate the movement, including when a previous attempt created the payee but failed before posting.

#### Scenario: Missing payee and valid expense
- **WHEN** an evidenced expense has no matching payee and no potentially duplicate movement
- **THEN** preview reports payee creation and apply creates exactly one payee and one verified expense.

#### Scenario: Similar or conflicting payee names
- **WHEN** a normalized case or whitespace equivalent payee or a transfer payee conflicts with the proposed exact name
- **THEN** the candidate remains in review and nothing is written.

#### Scenario: Interruption after payee creation
- **WHEN** a previous attempt created the exact payee but did not post the expense
- **THEN** retrying the same source uses the existing payee and never creates a duplicate payee or movement.

#### Scenario: Concurrent budget change
- **WHEN** the budget changes between backup and final pre-write revalidation
- **THEN** the adapter stops before creating the payee or transaction.
