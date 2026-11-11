# actual-historical-transfer-origin Specification

## Purpose
Correct a verified historical own-account transfer source while retaining the existing pair and complete audit trail.

## Requirements

### Requirement: Correct historical transfer origin safely

The adapter SHALL accept exact reciprocal simple unowned unreconciled historical legs, an active distinct new origin, a unique sender receipt, and distinct inspected statements for origin and destination. The operator MUST establish identity, date, amount, ownership and account equivalence from source documents. The adapter SHALL reject duplicate candidates, stale snapshots, changed provenance, unsupported accounts and ambiguous transfer payees.

#### Scenario: Verified correction
- **WHEN** the exact preview is approved by the operator's evidence and an exclusive lease is held
- **THEN** the adapter SHALL back up and record intent before changing only the old source account and destination payee, synchronize and independently verify both legs, all balances and all unrelated data.

#### Scenario: Interrupted or conflicting operation
- **WHEN** an audit is pending, a source is already owned or any identity or invariant differs
- **THEN** the adapter SHALL refuse another write and require inspection of the backup and live transactions.

#### Scenario: Identical completed retry
- **WHEN** the exact candidate already has a completed audit
- **THEN** the adapter SHALL verify the resulting pair without another mutation or backup.
