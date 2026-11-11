## ADDED Requirements

### Requirement: Retire a user-confirmed twin historical split
The adapter SHALL support a separate operation to retire one of two historical split parents only when the operator has independently inspected a bank statement and the user explicitly confirmed they represent one purchase. It SHALL require exact snapshots of both unowned, unreconciled, uncleared, unscheduled, unimported split parents in the same active account, distinct IDs, equal negative totals, dates at most one day apart, and a unique bijection between every child by category and amount. The operator SHALL verify the statement confirms a single charge on the retained date. Source identifiers and confirmation text alone do not establish that evidence. The adapter SHALL retain the other parent and its children unchanged and SHALL back up, revalidate under lease and lock, write durable pending intent before deletion, synchronize and independently compare the entire budget before completing the audit. A pending or unexplained partial write SHALL block a retry; an identical complete audit SHALL verify without a new financial write.

#### Scenario: Confirmed duplicate with identical allocation
- **WHEN** the user confirms one purchase, the statement and exact snapshots satisfy all conditions and the candidate is applied under lease
- **THEN** the adapter SHALL retire only the specified parent and children and verify the retained split and unrelated data unchanged.

#### Scenario: Ambiguous or changed split
- **WHEN** identity, user confirmation, child bijection, source, dates, ownership or snapshot do not satisfy the requirements
- **THEN** the adapter SHALL reject without a financial write.

#### Scenario: Interrupted operation or exact retry
- **WHEN** an audit is pending or the old split is absent without a completed exact audit
- **THEN** the adapter SHALL stop for investigation; an identical completed audit SHALL be read-only.
