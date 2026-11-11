# actual-cross-account-refunds Specification

## Purpose
Allow independently evidenced refunds to reduce a purchase when settled in a different account.

## Requirements

### Requirement: Evidence-gated cross-account refund
The adapter SHALL permit an explicitly declared cross-account refund only when the original simple categorized purchase, both account identities, merchant refund evidence and bank settlement evidence are identified. It SHALL retain the purchase category, provenance and cumulative refund limit, and use backup, lock, sync and independent readback. Other refunds SHALL continue requiring the same account.

#### Scenario: Cross-account settlement
- **WHEN** a purchase on one account is refunded to another with distinct merchant and bank evidence
- **THEN** the refund is recorded in the destination account as a positive amount in the original category, linked to the unchanged purchase.

#### Scenario: Missing proof or over-refund
- **WHEN** required account identities or distinct evidence are missing or linked refunds would exceed the original purchase
- **THEN** the adapter rejects the candidate without writing.
