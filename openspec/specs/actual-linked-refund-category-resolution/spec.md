# actual-linked-refund-category-resolution Specification

## Purpose
Resolve the category of a verified purchase and its linked cross-account refund consistently without duplicating financial movements.

## Requirements

### Requirement: Paired resolution with complete audit
The adapter SHALL accept only exact verified purchase and refund snapshots, matching pending ledger records and completed refund audit, a selected existing expense category and an explicit reason. It SHALL require a lease, lock, preview bound to the entire current budget and candidate, backup and durable pending intent, then change the category of the two linked transactions and their records, and remove only the exact generated pending-category line from the refund note, synchronize and independently verify all data, balances and source provenance.

#### Scenario: Confirmed category
- **WHEN** the operator selects a supported category and the two exact linked entries and source audits match
- **THEN** both entries use the same category, the obsolete generated pending-category line is removed while all other text and sources are preserved, and their records become registered after successful independent verification.

#### Scenario: Conflict or interruption
- **WHEN** a transaction, ledger record, source, amount, category or audit conflicts, or a previous resolution is pending
- **THEN** no retry may make another financial write without investigation.

#### Scenario: Exact completed retry
- **WHEN** the exact completed resolution is retried
- **THEN** it verifies both entries and records without another write.
