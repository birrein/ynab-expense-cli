# actual-historical-split-child-refund Specification

## Purpose
Allow a settled card refund to be recorded against a specifically evidenced item in an existing historical split while retaining the original transaction.

## Requirements

### Requirement: Verify and link a historical split item refund
The adapter SHALL require the exact unchanged historical parent and child, a same-account settlement, distinct bank statement and merchant refund evidence, a refund source not already used elsewhere, the child's category, and a cumulative refund not exceeding the child. It SHALL preserve the original split and all unrelated records, require plan, lease, lock, backup, sync, and independent readback, and retain the child link in the refund and ledger. Existing restrictions for simple and cross-account refunds SHALL remain in force.

#### Scenario: Settled item refund
- **WHEN** the parent snapshot, child, category, bank statement and merchant evidence agree and no duplicate or excessive refund exists
- **THEN** one positive refund is recorded in the same account and child's category on its settlement date and linked to the child, without modifying the purchase.

#### Scenario: Conflict or excessive refund
- **WHEN** the parent has changed, a prior refund is ambiguous or the cumulative amount exceeds the item
- **THEN** the adapter refuses to write.

#### Scenario: Retry after verification
- **WHEN** the same source is retried following a successful write
- **THEN** the adapter verifies the existing refund rather than creating another.
