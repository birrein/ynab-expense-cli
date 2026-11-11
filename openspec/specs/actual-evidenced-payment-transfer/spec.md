# actual-evidenced-payment-transfer Specification

## Purpose
Convert independently evidenced credit-line principal payments already imported as expenses into accurate linked transfers without losing their original identity.

## Requirements

### Requirement: Convert an evidenced historical payment safely
The adapter SHALL accept an exact unreconciled simple payment and two verified statements identifying both accounts, the principal amount and date. It SHALL reject identity, ledger, duplicate, account, date or source conflicts. It SHALL preserve the original transaction ID, amount, date, notes and imported ID.

#### Scenario: Confirmed principal payment
- **WHEN** both statement rows and the exact existing transaction match
- **THEN** plan proposes conversion and apply requires lease, lock, backup and revalidation, converts through the official API, waits for the linked operation, synchronizes, independently verifies both legs, balances and unrelated records, and records an audit.

#### Scenario: Retry or incomplete conversion
- **WHEN** the same request is retried after a verified audit
- **THEN** it checks the existing pair and performs no additional financial write; a partial or unaudited state fails closed for investigation.

#### Scenario: Conflicting evidence or matching transaction
- **WHEN** another destination credit could be the same payment or a bank statement or transaction identity conflicts
- **THEN** the adapter refuses to mutate the budget.

### Requirement: Convert an independently evidenced historical incoming credit
The adapter SHALL allow conversion of a precisely identified uncategorized historical standalone positive credit into a reciprocal own-account transfer only when the operator has independently checked a sender receipt and destination statement, and no possible origin debit exists. It SHALL preserve the historical credit ID, account, date, amount and other unrelated fields, replace obsolete notes with linked provenance, add exactly one opposite origin leg, and not fabricate a historical imported source.

#### Scenario: Confirmed incoming own transfer
- **WHEN** exact live credit identity, sender receipt, destination statement and account ownership match and no other plausible origin debit exists
- **THEN** preview proposes conversion and commit requires lease, lock, backup, revalidation and pending audit before writing, then synchronizes, independently verifies both legs, all balances and unrelated records, and completes the audit.

#### Scenario: Conflicting identity, evidence or duplicate
- **WHEN** any source, account, note, amount, identity, ownership, prior audit, transfer link or possible duplicate conflicts
- **THEN** the operation SHALL stop without a financial write.

#### Scenario: Interrupted or exact completed conversion
- **WHEN** a write was interrupted or a pending audit exists
- **THEN** it SHALL stop for investigation; a retry after complete audit SHALL verify the exact linked pair without another write.
