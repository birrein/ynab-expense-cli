## ADDED Requirements

### Requirement: Correct income with one complete covering statement and independent receipt
The adapter SHALL accept an explicit alternative to two distinct statements when a single complete statement covers both the old and new dates, and a separately inspected bank receipt uniquely identifies the payer, destination, original date and amount. The operator SHALL inspect both dates and establish the actual posting and absence of competing income. The adapter SHALL require explicit valid statement boundaries encompassing both dates, the receipt identifier and original date, and SHALL reject conflicting or already-owned source references. All snapshot, payer, amount, nearby duplicate, hash, lease, backup, full independent readback and pending-audit safeguards SHALL remain unchanged.

#### Scenario: Receipt and complete statement establish one income
- **WHEN** a verified receipt and the complete covering statement uniquely identify the existing income and its later posting
- **THEN** the adapter previews and verifies the date correction without another income or any category change.

#### Scenario: Insufficient coverage or conflicting evidence
- **WHEN** either date falls outside the declared statement boundaries, the receipt is missing, its date differs or its source is already owned, or any snapshot or identity validation fails
- **THEN** no mutation is permitted.
