## ADDED Requirements

### Requirement: Support a provider receipt archived in Drive
The adapter SHALL allow an independently verified provider receipt identified by a Drive file ID as an exclusive alternative to the existing evidence modes. The receipt ID SHALL be valid and distinct from the bank statement ID. The operator SHALL independently inspect the receipt and bank statement to verify the transaction identity, card, date, merchant and amount. All existing safeguards and constraints for historical amount corrections SHALL remain in force.

#### Scenario: Provider receipt and statement agree
- **WHEN** the operator has verified the provider receipt and distinct bank statement establish the same transaction and corrected amount
- **THEN** the adapter SHALL permit the existing preview and audited amount-only correction workflow.

#### Scenario: Ambiguous or invalid evidence
- **WHEN** the provider receipt ID is invalid, equals the statement ID, or another evidence mode is also supplied
- **THEN** the adapter SHALL reject the candidate without writing.
