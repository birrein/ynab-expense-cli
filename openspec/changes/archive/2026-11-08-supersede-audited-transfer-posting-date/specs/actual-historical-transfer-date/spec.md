## ADDED Requirements

### Requirement: Preserve a superseded transfer-date audit
The adapter SHALL allow a statement-backed one-leg posting-date correction after a completed historical transfer-date correction only with explicit linkage to that exact completed audit, full snapshots matching the previous verified outcome, independent receipt and distinct origin and destination statements, and all existing posting-date controls. It SHALL preserve the previous audit unchanged and create a separate pending and completed audit. A repeat verification of the previous correction SHALL accept the new state only if a complete matching linked posting-date audit proves the exact subsequent state. Pending, absent, mismatched or unrelated audit chains SHALL never authorize a write or a successful repeat verification.

#### Scenario: Exact complete history
- **WHEN** the prior complete audit, snapshots, independent evidence and posting-date plan match
- **THEN** the adapter updates the evidenced single leg and both audits can subsequently be verified without rewriting.

#### Scenario: Unlinked or interrupted history
- **WHEN** the previous audit is absent or pending, snapshots do not match its result, or the subsequent audit is pending or mismatched
- **THEN** the adapter refuses the operation or repeat verification without making a financial write.
