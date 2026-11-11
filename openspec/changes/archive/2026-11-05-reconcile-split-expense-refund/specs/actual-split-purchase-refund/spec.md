## Purpose

Restore the true dates and amounts of a split purchase and its settled partial refund without duplicating either event.

## ADDED Requirements

### Requirement: Reconstruct an evidenced split purchase and refund
The adapter SHALL require an exact unreconciled ledger-owned split, matching source records, distinct bank and merchant evidence, a verified refund category, gross and refund amounts that preserve the net total, and an unused refund source. It SHALL preview the exact change and require lease, lock, full backup, revalidation, sync and independent full-budget verification. It SHALL preserve the purchase and child IDs and all unrelated fields, sources, transactions, and balances. It SHALL update all related source records and retain a durable audit. An interrupted or conflicting state SHALL stop for manual investigation without retrying writes.

#### Scenario: Confirmed gross charge and refund
- **WHEN** the exact original split, gross amount, subsequent bank refund, dates and category match the supplied evidence
- **THEN** the chosen child and parent increase by the refund amount, a linked refund is created in that category and account on its settlement date, and the net total is unchanged.

#### Scenario: Repeat audited operation
- **WHEN** the identical candidate is retried after verified completion
- **THEN** it is checked against the complete audited state without another write.

#### Scenario: Incomplete or conflicting operation
- **WHEN** the live state, evidence, source ledger, duplicate scan or audit differs
- **THEN** the operation stops without issuing a financial write.
