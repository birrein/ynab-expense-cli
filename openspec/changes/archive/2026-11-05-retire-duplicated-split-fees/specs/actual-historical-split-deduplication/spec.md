## Purpose

Prevent duplicated card debt when historical split fees duplicate independently verified statement fee lines.

## ADDED Requirements

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
