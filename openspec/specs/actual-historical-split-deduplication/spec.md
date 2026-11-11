# actual-historical-split-deduplication Specification

## Purpose
Prevent duplicated card debt when historical split fees duplicate independently verified statement fee lines.

## Requirements

### Requirement: Exact historical split duplicate retirement
The adapter SHALL require exact identity of an unowned, unreconciled historical split parent and every child, plus a bijection from all children to individually ledger-verified statement expense records of the same account, date, amount and category. It SHALL verify a complete statement, preserve all retained transactions, back up, lock, revalidate, synchronize, independently read back all unrelated state and audit before declaring success.

#### Scenario: Duplicate split fee
- **WHEN** every child of an old split matches a unique individually recorded fee and the statement confirms those fee lines once
- **THEN** only the parent and its contained children are retired and the individually verified records remain intact.

#### Scenario: Partial or unsafe match
- **WHEN** any child, category, amount, ownership, reconciliation state or evidence is inconsistent
- **THEN** the adapter SHALL refuse to write.

#### Scenario: Interrupted retirement
- **WHEN** the parent is absent without matching durable audit
- **THEN** the adapter SHALL stop without writing or changing identities.

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
