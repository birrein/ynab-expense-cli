## MODIFIED Requirements

### Requirement: Verify a complete historical installment series before retiring its total
The adapter SHALL require one exact, simple, unreconciled historical purchase total and a complete set of at least two distinct, simple installment transactions. Every number from 1 through N SHALL appear exactly once; the recorded installment amounts SHALL sum exactly to the total, or to the total plus an explicitly evidenced, positive and arithmetically exact financing cost. They SHALL share its account, payee and category, and correspond to monthly statement periods. Each installment SHALL have a distinct, independently inspected statement identifier and exact statement amount. The operator SHALL establish that the statements and original purchase evidence identify the same purchase; missing evidence, conflicting ledger ownership, altered transactions or ambiguous matches MUST prevent writes.

#### Scenario: Complete evidenced duplicate
- **WHEN** a purchase total and every installment are identified exactly and the independent statements confirm the same series and amounts
- **THEN** preview proposes retiring only the purchase total and preserving every installment.

#### Scenario: Complete financed series
- **WHEN** the complete evidenced installments exceed the purchase price by the stated positive financing cost
- **THEN** preview proposes retiring only the original price and retaining every billed installment.

#### Scenario: Partial or ambiguous series
- **WHEN** any statement, installment number, amount, financing cost, account, category, payee, identity, or evidence is missing or inconsistent
- **THEN** preview and commit refuse the operation without mutation.
