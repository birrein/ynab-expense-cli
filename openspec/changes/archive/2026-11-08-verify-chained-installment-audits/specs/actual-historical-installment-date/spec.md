## ADDED Requirements

### Requirement: Verify a completed installment date through later audit lineage
For an exact completed date-correction candidate, the adapter SHALL accept the target and neighbors only when each current snapshot equals the saved snapshot or is reachable by a unique, strictly later sequence of completed, backed-up, verified per-transaction amount or date corrections with exact full snapshots and matching currency and identity. Each transition SHALL change only the field specified in its audit. This applies only to a read-only retry; a new write SHALL continue requiring exact current snapshots. Pending, ambiguous, unaudited or otherwise changed data SHALL be rejected.

#### Scenario: Date then audited amount change
- **WHEN** the identical completed date correction is retried and a subsequent completed amount audit exactly connects the verified date snapshot to the current target
- **THEN** verification returns existing without a write.

#### Scenario: Neighbor has a subsequent verified correction
- **WHEN** a saved neighbor reaches its current snapshot through exact later completed date or amount audits
- **THEN** the adapter accepts that neighbor on the read-only retry.

#### Scenario: Unverified mutation
- **WHEN** a subsequent link is pending, nonchronological, ambiguous or changes any unaudited field
- **THEN** the adapter rejects without a write.
