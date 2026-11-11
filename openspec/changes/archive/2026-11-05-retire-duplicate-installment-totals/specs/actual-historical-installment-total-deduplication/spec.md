## Purpose

Preserve independently evidenced installments while removing a duplicate historical purchase total, so card balances and spending do not count the same purchase twice.

## ADDED Requirements

### Requirement: Verify a complete historical installment series before retiring its total
The adapter SHALL require one exact, simple, unreconciled historical purchase total and a complete set of at least two distinct, simple installment transactions. Every number from 1 through N SHALL appear exactly once; the recorded installment amounts SHALL sum exactly to the total, share its account, payee and category, and correspond to monthly statement periods. Each installment SHALL have a distinct, independently inspected statement identifier and exact statement amount. The operator SHALL establish that the statements and original purchase evidence identify the same purchase; missing evidence, conflicting ledger ownership, altered transactions or ambiguous matches MUST prevent writes.

#### Scenario: Complete evidenced duplicate
- **WHEN** a purchase total and every installment are identified exactly and the independent statements confirm the same series and amounts
- **THEN** preview proposes retiring only the purchase total and preserving every installment.

#### Scenario: Partial or ambiguous series
- **WHEN** any statement, installment number, amount, account, category, payee, identity, or evidence is missing or inconsistent
- **THEN** preview and commit refuse the operation without mutation.

### Requirement: Preserve and audit the removal
The operation SHALL require an active owned lease and exclusive lock, a private backup and revalidation before deletion. It SHALL synchronize, independently read the budget and verify the exact balance change, unchanged installments and unchanged unrelated data; it SHALL persist the exact candidate and retired original in a durable audit. A retry SHALL return success only for an exactly matching verified audit and SHALL never create or delete another transaction.

#### Scenario: Verified deletion
- **WHEN** the exact preview is committed and independently verified
- **THEN** only the duplicate total is absent, the account balance changes by its negated amount and all installments remain unchanged.

#### Scenario: Missing total without audit
- **WHEN** the purchase total is absent but no matching verified audit exists
- **THEN** the adapter stops and requires recovery from the backup rather than retrying or modifying identities.
