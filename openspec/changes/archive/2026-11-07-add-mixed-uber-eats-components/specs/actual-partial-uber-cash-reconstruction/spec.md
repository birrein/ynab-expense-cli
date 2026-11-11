## ADDED Requirements

### Requirement: Accept evidenced Uber Eats mixed payments
The adapter SHALL accept a previously recorded Uber Eats card component with an existing Eating Out & Delivery category when the complete receipt and statement prove a mixed card and Uber Cash order. All source ownership, exact total, duplicate prevention, lease, digest, backup, audit, independent readback and partial-balance requirements for mixed components SHALL continue to apply. It SHALL reject mismatched payee-category pairs and SHALL NOT apply this exception to unknown merchants or categories.

#### Scenario: Uber Eats order with matching dining category
- **WHEN** the card component and ledger are verified as Uber Eats in Eating Out & Delivery and a receipt confirms the missing wallet component
- **THEN** only the evidenced wallet component SHALL be added with the same dining category and grouped with the original receipt.

#### Scenario: Conflicting category
- **WHEN** the card component's payee or category does not match either the supported Uber ride or Uber Eats order pairing
- **THEN** the operation SHALL stop without writing.
