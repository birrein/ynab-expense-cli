# actual-cross-account-statement-refunds Specification

## Purpose
Record an independently evidenced merchant refund settled in a different owned account while preserving the original purchase and avoiding duplicate credits.

## Requirements

### Requirement: Audited cross-account statement refund

The adapter SHALL accept a positive refund only when an operator has independently verified its relation to a simple, verified Gmail-ledger purchase with either a resolved category or an explicit reason for a pending category, a distinct active destination account, a merchant refund and the destination account statement. It SHALL retain the original purchase and category, identify the original and both sources, enforce the cumulative refund limit, reject stale or conflicting state and possible duplicates, and use a lease, preview bound to candidate and complete budget, backup, durable intent, synchronization and independent full-budget verification.

#### Scenario: Verified separate destination
- **WHEN** the original purchase, merchant refund and destination statement independently establish the same refund and no conflicting credit exists
- **THEN** one linked positive entry is created in the destination account with the original category and the purchase remains unchanged.

#### Scenario: Ambiguous or incomplete evidence
- **WHEN** the original category is unresolved without an explicit reason, evidence or accounts are missing, a linked refund would exceed the purchase, or a nearby credit or state conflict exists
- **THEN** the operation stops before any financial write.

#### Scenario: Interruption and retry
- **WHEN** an exact candidate has a completed audit
- **THEN** its current transaction, complete merchant ledger entry, sources and cumulative refund limit are rechecked without another write; a pending or conflicting audit blocks retry until investigation.

#### Scenario: Candidate or budget changed after preview
- **WHEN** the preview hash is absent or no longer matches the complete current budget and candidate
- **THEN** apply rejects the operation before backup or financial writes.

#### Scenario: Confirmed refund with category pending
- **WHEN** the purchase and refund are verified, category alone remains unresolved and an explicit reason is supplied
- **THEN** the refund is recorded uncategorized, both sources remain in Review, and one-sided category changes are blocked until paired resolution.
