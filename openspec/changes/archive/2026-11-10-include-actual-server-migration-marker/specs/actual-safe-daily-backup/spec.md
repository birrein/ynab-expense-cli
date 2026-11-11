## ADDED Requirements

### Requirement: Server migration marker accompanies database backup

Each newly created backup SHALL include the Actual server data directory's valid `.migrate` marker and include its size and SHA-256 in the backup manifest. The marker SHALL be copied while the existing shared backup lock is held. A missing or malformed marker SHALL cause a failed backup without creating a completed backup or modifying existing backups.

#### Scenario: Marker included and verified
- **WHEN** the server migration marker is present and valid and a new backup is created
- **THEN** its bytes are retained at `data/.migrate` and its manifest entry matches the copy.

#### Scenario: Marker missing or malformed
- **WHEN** the marker is absent or cannot be parsed as a migration state
- **THEN** the backup fails closed and preserves existing data and prior backups.
