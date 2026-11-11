## ADDED Requirements

### Requirement: Distinguish two identical billed rows using full statement totals

The adapter SHALL permit exactly one second expense with the same date, account, amount and merchant as a verified prior source only when the operator independently inspects two statement rows and a full statement arithmetic reconciliation corroborates both. The candidate SHALL bind stable distinct row ordinals and the exact prior snapshot and ledger, the same statement and amounts, and a bounded rounding discrepancy. Omitting one row MUST fail that same reconciliation tolerance. The adapter SHALL require all other duplicate, source, lease, backup, verification and audit safeguards. A confirmed expense MAY remain uncategorized with an explicit review reason.

#### Scenario: Two billed rows
- **WHEN** two identical rows and the complete statement totals are inspected and a single prior row is verified in the ledger
- **THEN** plan proposes the second source and commit verifies it without altering the first.

#### Scenario: Insufficient evidence or extra match
- **WHEN** either row, prior ledger, unique ordinal, arithmetic corroboration or statement identity is inconsistent, or another nearby match exists
- **THEN** no financial write occurs.

#### Scenario: Idempotent second-row retry
- **WHEN** the exact successful candidate is retried
- **THEN** the existing source is verified and no new expense is created.
