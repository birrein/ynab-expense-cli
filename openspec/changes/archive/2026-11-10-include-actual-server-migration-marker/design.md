## Context

The server uses an independently stored migration state file in `ACTUAL_DATA_DIR`, while the backup already snapshots SQLite under the adapter lock. A test restore of the database alone replayed incompatible migrations.

## Goals / Non-Goals

**Goals:** Preserve the server marker alongside its database and detect missing or malformed input.

**Non-Goals:** Change server versions, migrate schemas, change backup retention or include archived YNAB budgets in ordinary daily backups.

## Decisions

Read `.migrate` from `ACTUAL_DATA_DIR`, defaulting to `<pilot>/data`, while holding the existing backup lock. Validate JSON, `lastRun` and the migrations list; copy exactly to `data/.migrate`, include it in the existing SHA-256 manifest and fail if missing. The lock protects cooperating writers; it cannot freeze an independently running server upgrade, which remains an operational constraint.

## Risks / Trade-offs

- An older installation without a marker fails closed rather than creating a misleading database backup; operators must inspect that installation.
- Historical archives remain excluded from standard daily backups and require their separate migration supplement.
