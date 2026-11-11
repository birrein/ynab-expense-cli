# actual-evidenced-investment-currency-conversion Specification

## Purpose
Represent explicitly evidenced conversions between separately maintained investment cash budgets without recording them as earned income or consumption.

## Requirements

### Requirement: Preview an evidenced investment conversion

The adapter SHALL accept only an operator-directed USD debit and CLP credit with exact independently evidenced amounts, dates, active source and destination accounts, distinct stable source identities, statement and Gmail provenance and a shared reference. It SHALL preserve Gmail and statement links on both legs and record the Gmail ownership after verification. The USD expense and CLP income legs SHALL use purpose-specific transfer categories, and the preview SHALL disclose that the entries are not a native cross-budget transfer. It SHALL reject unverified identities, wrong category direction, missing evidence, existing source ownership, possible duplicates, incompatible audits or a changed snapshot. It SHALL NOT derive or calculate exchange rates, discover transactions automatically, claim a complete investment history, or overwrite any existing financial entry.

#### Scenario: Explicit independently supported amounts
- **WHEN** an operator supplies exact supported USD and CLP legs and the accounts, categories and report treatment have been checked
- **THEN** preview proposes precisely the supplied pair without a calculated rate, with source and shared reference visible.

#### Scenario: Evidence, duplicate or category conflicts
- **WHEN** one side is missing, ambiguous, already represented, or lacks a suitable transfer category
- **THEN** no mutation occurs and the result identifies the conflict.

### Requirement: Preserve reporting semantics

The operator MUST verify that the specifically affected income and expense widgets exclude the correct transfer categories and the new opening balance before recording. Dedicated correctly directed transfer categories MUST be used; a category named for an incoming amount MUST NOT represent an outgoing amount, or vice versa. The workflow SHALL document that other reports and newly created reports might require their own filters, without silently modifying them. The downstream bank receipt SHALL be represented as a native same-currency transfer separately and SHALL NOT be duplicated as income.

#### Scenario: Report safeguards absent
- **WHEN** necessary existing report filters or transfer categories are missing or unverified
- **THEN** the operator does not apply the conversion; the preview requires documented reporting evidence but does not inspect dashboard filters automatically.

### Requirement: Verify both budgets and recover safely

The operation SHALL require an owned lease and writer lock, independently back up and revalidate both budgets, save a pending audit before the first write, sync each leg and independently reload both full budgets to validate both exact entries, their balances and all unrelated data. A completed identical retry SHALL be read-only. Any pending audit or unexplained partial write SHALL stop automatic retries and require investigation using the original sources and backups.

#### Scenario: Full pair verified
- **WHEN** both explicit legs are applied and independent readback proves all invariants
- **THEN** the audit is marked complete and retains both transaction identifiers, sources and backups.

#### Scenario: Partial cross-budget write
- **WHEN** either write or verification fails after the pending audit is saved
- **THEN** no retry creates another leg until the state and backups are investigated.
