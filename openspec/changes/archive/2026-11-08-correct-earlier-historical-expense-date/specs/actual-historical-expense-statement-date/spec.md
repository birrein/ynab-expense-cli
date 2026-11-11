## ADDED Requirements

### Requirement: Correct an independently evidenced earlier expense posting
The adapter SHALL accept an explicit earlier-expense mode for an eligible simple categorized historical expense when an independently inspected receipt and one complete statement uniquely establish the posting. The new date SHALL be one to four days earlier than the historical date, the receipt date SHALL equal the new date, and the statement SHALL cover the receipt and both transaction dates. The operator SHALL verify the recipient, account, amount, identity, actual posting and absence of competing expenses. All existing source ownership, snapshot, daily balance preview, hash, lease, backup, pending audit and independent verification safeguards SHALL apply.

#### Scenario: Earlier cheque posting is proven
- **WHEN** a bank notice and covering statement uniquely identify the same categorized expense posted one day before its historical date
- **THEN** the adapter previews and independently verifies only the date correction.

#### Scenario: Evidence is missing or conflicts
- **WHEN** the explicit mode, receipt, coverage or identity is missing or inconsistent, or another safety control fails
- **THEN** no mutation is permitted.
