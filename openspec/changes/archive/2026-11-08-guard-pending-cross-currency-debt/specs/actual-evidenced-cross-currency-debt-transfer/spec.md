## ADDED Requirements

### Requirement: Block unrelated writes while debt transfer is pending
The adapter SHALL reject every financial mutation entrypoint before connecting to Actual whenever any cross-currency debt transfer audit is pending. It SHALL preserve read-only inspection and explicit lease closure without advancing unreviewed windows; an operator SHALL inspect both budgets and backups before recovery.

#### Scenario: A different operation follows partial transfer
- **WHEN** a debt transfer remains pending after a partial result and an unrelated apply, remove or budget mutation is requested
- **THEN** the adapter rejects the operation before a financial write and preserves the pending audit.
