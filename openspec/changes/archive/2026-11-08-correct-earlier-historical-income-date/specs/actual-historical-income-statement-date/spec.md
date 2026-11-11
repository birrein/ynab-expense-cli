## ADDED Requirements

### Requirement: Correct an independently evidenced earlier income posting
The adapter SHALL accept an explicitly selected earlier-posting alternative only for positive eligible historical income with a single complete statement and an independently inspected receipt. The new date SHALL precede the existing date by one to four days. The receipt date SHALL be on or before the bank posting and no more than four days earlier, and the statement SHALL cover the receipt, posting and historical dates. The operator SHALL verify payer, account, amount, posting and absence of competing transactions. All existing source ownership, snapshot, balance, preview, backup, pending audit and independent verification safeguards SHALL apply, and the preview SHALL report the signed balance effect for each affected day.

#### Scenario: Receipt establishes an earlier posting
- **WHEN** the complete statement and independent receipt uniquely identify an eligible income posted three days before its historical date
- **THEN** the adapter proposes moving only the date and independently verifies the resulting transaction and daily balances.

#### Scenario: Missing or conflicting evidence
- **WHEN** the receipt or statement does not cover the required dates, is already owned, the period exceeds the bound, a competing income exists, or the explicit mode is absent
- **THEN** the adapter refuses the correction without writing.
