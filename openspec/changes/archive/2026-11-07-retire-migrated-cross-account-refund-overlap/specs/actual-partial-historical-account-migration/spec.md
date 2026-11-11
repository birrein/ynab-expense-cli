## ADDED Requirements

### Requirement: Verify a subsequently resolved migration exception
A completed migration verification SHALL preserve its original excluded snapshots and recognize a missing excluded expense only if an exact completed, independently verified retirement audit explicitly names that migration and original snapshot, the retained net transaction remains exact, and the retirement's source evidence and backup are present. Any pending, mismatched, duplicated or absent audit SHALL fail closed.

#### Scenario: Exception retired with evidence
- **WHEN** a completed retirement audit matches exactly the absent excluded row and its unchanged net counterpart
- **THEN** the completed migration retry SHALL verify the resolved exception without rewriting either audit.

#### Scenario: Unsubstantiated missing exception
- **WHEN** the excluded row is absent and its retirement audit is missing, pending, conflicting, duplicated or its counterpart changed
- **THEN** migration verification SHALL fail without writing.
