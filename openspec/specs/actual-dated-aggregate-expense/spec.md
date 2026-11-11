# actual-dated-aggregate-expense Specification

## Purpose
Retire a duplicate aggregate when bank posting and itemized receipt dates differ by one day.

## Requirements

### Requirement: Dated itemized receipt duplicate
The adapter SHALL allow a ledger-owned aggregate to be retired against two or more exact historical items dated one day earlier only with an explicit itemized receipt identity and a matching bank statement. It SHALL preserve item categories, source protections, audit, backup, locking and independent readback.

#### Scenario: Earlier receipt
- **WHEN** all itemized historical entries match the same merchant, account, receipt date and exact sum of the following day's single statement charge
- **THEN** the aggregate is retired and the itemized entries remain unchanged.

#### Scenario: Unsupported mismatch
- **WHEN** receipt identity, dates, components, source or sum differs
- **THEN** no transaction is removed.
