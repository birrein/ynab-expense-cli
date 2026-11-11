## ADDED Requirements

### Requirement: Correct an evidenced historical income date
The adapter SHALL accept exactly one complete snapshot of a positive simple non-reconciled historical income without imported source or ledger ownership, an active account, two distinct bank statements and detailed operator-verified evidence. The new date SHALL be one to four days later. The operator SHALL verify payer, amount, account, the unique posting and absence of a competing transaction by reviewing both surrounding statements. The adapter SHALL reject conflicting snapshots, sources, accounts, or nearby equal-amount income. It SHALL preview a hash bound to the full budget, dashboard and stable ledger with daily balance effects, preserve all fields except date, and keep final balances unchanged.

#### Scenario: Unique identified income
- **WHEN** both statements and the historical transaction uniquely support the same income and later bank posting date
- **THEN** the adapter proposes updating that existing transaction date without creating another income.

#### Scenario: Evidence or identity conflict
- **WHEN** the statements, payer, snapshot, amount, date or nearby records conflict
- **THEN** no write is permitted.

### Requirement: Audited independent verification
The adapter SHALL require a matching preview hash, lease and lock, backup, revalidation and durable pending audit before writing. It SHALL independently download and compare the full budget, dashboard, all transaction fields, final balances and expected daily balances before marking the audit complete. A pending audit SHALL block financial mutations, and an exact completed retry SHALL only verify.

#### Scenario: Interrupted mutation
- **WHEN** a write or verification fails after the pending audit is saved
- **THEN** the backup and pending audit remain and subsequent mutations are blocked.
