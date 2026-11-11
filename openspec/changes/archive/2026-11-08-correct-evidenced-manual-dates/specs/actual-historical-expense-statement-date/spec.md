## ADDED Requirements

### Requirement: Correct a manually entered expense date from matching evidence
The adapter SHALL allow an explicitly selected correction of an eligible categorized historical expense by one to seven days forward when an independently inspected receipt and complete covering statement agree on the new transaction date, account, recipient and amount. It SHALL retain all source ownership, competing expense, full snapshot, lease, backup, pending-audit and independent readback safeguards.

#### Scenario: Receipt and bank posting agree
- **WHEN** a receipt and covering statement uniquely establish that the expense occurred six days after its manual date
- **THEN** the adapter previews and verifies a date-only correction.

#### Scenario: Ambiguous or incomplete evidence
- **WHEN** proof is missing, dates or accounts conflict, a competing expense exists, the mode is absent or any other control fails
- **THEN** no write is permitted.
