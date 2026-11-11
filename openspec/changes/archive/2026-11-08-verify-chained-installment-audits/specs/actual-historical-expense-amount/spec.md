## ADDED Requirements

### Requirement: Verify a completed installment amount through later audit lineage
For an exact previously completed installment amount candidate backed by a statement series or identified by `#cuotas` in its original note, the adapter SHALL accept the target and any saved neighbors only when each current snapshot equals its saved snapshot or is reachable by a unique, strictly later sequence of completed, backed-up, verified per-transaction amount or date corrections with exact full snapshots and matching currency and identity. Each transition SHALL change only the field specified in its audit. This applies only to a read-only retry; a new write SHALL continue requiring exact current snapshots. Pending, ambiguous, unaudited or otherwise changed data SHALL be rejected.

#### Scenario: Amount then audited date change
- **WHEN** the identical completed amount correction is retried and a subsequent completed date audit exactly connects the verified amount snapshot to the current target
- **THEN** verification returns existing without a write.

#### Scenario: Neighbor has a subsequent verified correction
- **WHEN** a saved neighbor reaches its current snapshot through exact later completed date or amount audits
- **THEN** the adapter accepts that neighbor on the read-only retry.

#### Scenario: History does not prove the change
- **WHEN** the chain contains a pending link, timestamp conflict, mismatching full snapshot, different currency or unapproved field change
- **THEN** the adapter rejects without a write.
