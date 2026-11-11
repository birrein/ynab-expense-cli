# actual-evidenced-cross-currency-debt-transfer Specification

## Purpose
Represent a bank-confirmed conversion of credit card debt between two existing currency budgets without inventing an exchange rate or additional consumption.

## Requirements

### Requirement: Preview explicitly evidenced cross-budget debt movement
The adapter SHALL require the operator to inspect a statement containing both exact currency amounts, date, debt accounts and card identity. It SHALL accept only an explicit directed CLP debit and USD credit with distinct stable bank source identifiers, exact existing transfer-exclusion categories and one issuer-specific common reference. Banco de Chile and RappiCard references SHALL be distinct; a RappiCard reference SHALL require RappiCard accounts in both budgets and RappiCard-specific bank sources. It SHALL refuse invalid evidence, missing categories, inactive accounts, duplicated sources, close amount matches or a mismatched prior audit. It SHALL NOT compute exchange rates, automatically discover conversions, or claim native cross-budget linkage. The entries are not consumption or income economically; existing category-based report filters apply only to configured widgets.

#### Scenario: Two statement-backed amounts
- **WHEN** the operator provides exact verified statement rows, supported accounts, categories and no duplicate in either budget
- **THEN** preview proposes both specified entries with shared reference and no exchange-rate calculation.

#### Scenario: RappiCard conversion
- **WHEN** a RappiCard statement explicitly establishes both amounts and the candidate identifies RappiCard accounts, sources and its own issuer-specific reference
- **THEN** preview accepts the conversion without labeling it as Banco de Chile and preserves all existing safety controls.

#### Scenario: Incorrect issuer identity
- **WHEN** a RappiCard reference is paired with a different issuer's account or bank source
- **THEN** the adapter rejects the candidate before any write.

#### Scenario: Ambiguous source or duplicate
- **WHEN** either row, account, category, source or potential match is ambiguous or unsupported
- **THEN** the adapter stops before any write.

### Requirement: Back up and independently verify both budgets
The adapter SHALL require one owning lease and writer lock, export both budget backups, revalidate both snapshots, record a pending audit before the first write, write only the two sourced entries, then synchronize and independently verify both complete budgets and both exact balance changes before marking audit complete. An exact completed retry SHALL only verify the pair. A pending audit or an unexplained partial result SHALL block automatic retry and require investigation.

#### Scenario: Confirmed pair
- **WHEN** both verified rows are written
- **THEN** only the designated account balances change by the stated amounts, both shared notes and categories persist, and the audit completes after independent readback.

#### Scenario: Partial write
- **WHEN** either write or verification fails after the audit is pending
- **THEN** a retry SHALL refuse additional writes until the operator inspects the state and backups.

### Requirement: Block unrelated writes while debt transfer is pending
The adapter SHALL reject every financial mutation entrypoint before connecting to Actual whenever any cross-currency debt transfer audit is pending. It SHALL preserve read-only inspection and explicit lease closure without advancing unreviewed windows; an operator SHALL inspect both budgets and backups before recovery.

#### Scenario: A different operation follows partial transfer
- **WHEN** a debt transfer remains pending after a partial result and an unrelated apply, remove or budget mutation is requested
- **THEN** the adapter rejects the operation before a financial write and preserves the pending audit.
