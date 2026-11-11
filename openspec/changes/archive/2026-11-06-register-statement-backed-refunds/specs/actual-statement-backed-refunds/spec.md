## Purpose

Preserve independently evidenced charge and refund dates when reconciling simple expenses from bank statements.

## ADDED Requirements

### Requirement: Statement-backed refund of a verified expense
The adapter SHALL accept a separately evidenced statement refund only for an exact verified simple expense in the same account and category, with an unused bank source and a refund date no earlier than the purchase. It SHALL reject conflicting credits, stale ledger state, missing evidence and cumulative refunds exceeding the original expense. It SHALL use a run lease, preview, backup, pre-write revalidation, durable intent, synchronization and independent full-budget readback. The original expense and unrelated state SHALL remain unchanged and a completed audit SHALL make an exact retry read-only. An interrupted or conflicting operation SHALL stop without another financial write.

#### Scenario: Confirmed bank refund
- **WHEN** an independently verified statement identifies a refund for a matching, ledger-owned simple purchase
- **THEN** a linked positive entry is recorded in the purchase category on the statement credit date and the original remains unchanged.

#### Scenario: Duplicate or incomplete evidence
- **WHEN** the refund is unverified, exceeds the original, is already present, or conflicts with an unaudited prior operation
- **THEN** the adapter refuses to create a financial transaction.

#### Scenario: Verified retry
- **WHEN** the same candidate is retried after a completed independent verification
- **THEN** the adapter verifies the audited entry and performs no financial write.
