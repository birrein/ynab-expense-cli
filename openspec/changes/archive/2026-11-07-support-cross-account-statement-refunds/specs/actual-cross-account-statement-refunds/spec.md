## Purpose

Record an independently evidenced merchant refund settled in a different owned account while preserving the original purchase and avoiding duplicate credits.

## ADDED Requirements

### Requirement: Audited cross-account statement refund

The adapter SHALL accept a positive refund only when an operator has independently verified its relation to a categorized, simple, verified Gmail-ledger purchase, a distinct active destination account, a merchant refund and the destination account statement. It SHALL retain the original purchase and category, identify the original and both sources, enforce the cumulative refund limit, reject stale or conflicting state and possible duplicates, and use a lease, preview bound to candidate and complete budget, backup, durable intent, synchronization and independent full-budget verification.

#### Scenario: Verified separate destination
- **WHEN** the original purchase, merchant refund and destination statement independently establish the same refund and no conflicting credit exists
- **THEN** one linked positive entry is created in the destination account with the original category and the purchase remains unchanged.

#### Scenario: Ambiguous or incomplete evidence
- **WHEN** the original is uncategorized, evidence or accounts are missing, a linked refund would exceed the purchase, or a nearby credit or state conflict exists
- **THEN** the operation stops before any financial write.

#### Scenario: Interruption and retry
- **WHEN** an exact candidate has a completed audit
- **THEN** its current transaction, complete merchant ledger entry, sources and cumulative refund limit are rechecked without another write; a pending or conflicting audit blocks retry until investigation.

#### Scenario: Candidate or budget changed after preview
- **WHEN** the preview hash is absent or no longer matches the complete current budget and candidate
- **THEN** apply rejects the operation before backup or financial writes.
