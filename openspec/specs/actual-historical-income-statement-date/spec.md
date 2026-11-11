# actual-historical-income-statement-date Specification

## Purpose
TBD - created by archiving change correct-historical-income-statement-date. Update Purpose after archive.

## Requirements

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

### Requirement: Correct income with one complete covering statement and independent receipt
The adapter SHALL accept an explicit alternative to two distinct statements when a single complete statement covers both the old and new dates, and a separately inspected bank receipt uniquely identifies the payer, destination, original date and amount. The operator SHALL inspect both dates and establish the actual posting and absence of competing income. The adapter SHALL require explicit valid statement boundaries encompassing both dates, the receipt identifier and original date, and SHALL reject conflicting or already-owned source references. All snapshot, payer, amount, nearby duplicate, hash, lease, backup, full independent readback and pending-audit safeguards SHALL remain unchanged.

#### Scenario: Receipt and complete statement establish one income
- **WHEN** a verified receipt and the complete covering statement uniquely identify the existing income and its later posting
- **THEN** the adapter previews and verifies the date correction without another income or any category change.

#### Scenario: Insufficient coverage or conflicting evidence
- **WHEN** either date falls outside the declared statement boundaries, the receipt is missing, its date differs or its source is already owned, or any snapshot or identity validation fails
- **THEN** no mutation is permitted.

### Requirement: Correct an independently evidenced earlier income posting
The adapter SHALL accept an explicitly selected earlier-posting alternative only for positive eligible historical income with a single complete statement and an independently inspected receipt. The new date SHALL precede the existing date by one to four days. The receipt date SHALL be on or before the bank posting and no more than four days earlier, and the statement SHALL cover the receipt, posting and historical dates. The operator SHALL verify payer, account, amount, posting and absence of competing transactions. All existing source ownership, snapshot, balance, preview, backup, pending audit and independent verification safeguards SHALL apply, and the preview SHALL report the signed balance effect for each affected day.

#### Scenario: Receipt establishes an earlier posting
- **WHEN** the complete statement and independent receipt uniquely identify an eligible income posted three days before its historical date
- **THEN** the adapter proposes moving only the date and independently verifies the resulting transaction and daily balances.

#### Scenario: Missing or conflicting evidence
- **WHEN** the receipt or statement does not cover the required dates, is already owned, the period exceeds the bound, a competing income exists, or the explicit mode is absent
- **THEN** the adapter refuses the correction without writing.

### Requirement: Correct an income date using a verified employer payslip
The adapter SHALL permit an explicit payroll evidence alternative for a positive eligible historical income when one complete bank statement covers both dates and an independently inspected employer payslip for the same month identifies the employee, employer and matching advance. The operator SHALL verify the unique bank credit, its payer, amount and date, the historical record and the complete statement, and establish there is no other matching advance. The new date SHALL be one to four days later in the same month. The adapter SHALL require a distinct payslip Drive identifier, declared month and covering statement boundaries, and reject any other same-account equal-amount income in that month. All existing snapshot, payer, nearby duplicate, hash, lease, lock, backup, pending-audit and full independent verification safeguards SHALL apply.

#### Scenario: Unique payroll advance
- **WHEN** a complete covering statement and verified same-month payslip identify a unique eligible advance with a later posting date
- **THEN** the adapter previews and independently verifies only the date correction without creating an income.

#### Scenario: Ambiguous or insufficient evidence
- **WHEN** evidence is missing, the payslip month differs, another matching income exists in the same account and month, dates fall outside the statement, or the explicit mode conflicts with another evidence mode
- **THEN** no write occurs.
