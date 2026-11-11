## ADDED Requirements

### Requirement: Correct the origin date using a distinct destination issuer receipt
The adapter SHALL allow the operator to substitute an independently inspected destination issuer receipt for the destination statement only when correcting the origin date of a simple existing reciprocal transfer. It SHALL require a distinct source-bank receipt, the complete origin statement, an explicit destination receipt ID and date equal to the unchanged destination date, and a gap of at most four days. Both source IDs SHALL be unowned and not attached to another transaction or audit. The operator SHALL verify both receipts, accounts, amount, destination posting semantics and lack of competing transfers. Existing full snapshots, preview hash, lease, backup, pending-audit and independent full-budget verification requirements SHALL remain in force.

#### Scenario: Issuer receipt and bank statement establish dates
- **WHEN** the source receipt and statement establish the origin posting and the distinct destination issuer receipt establishes the unchanged destination posting
- **THEN** only the origin date is updated and the existing pair is independently verified.

#### Scenario: Missing or conflicting evidence
- **WHEN** either receipt is missing, reused, owned, inconsistent, the destination date changes, the issuer date differs, or a competing payment exists
- **THEN** no mutation is allowed.
