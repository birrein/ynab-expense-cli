## Purpose
Represent a bank-confirmed conversion of credit card debt between two existing currency budgets without inventing an exchange rate or additional consumption.

## ADDED Requirements

### Requirement: Preview explicitly evidenced cross-budget debt movement
The adapter SHALL require the operator to inspect a statement containing both exact currency amounts, date, debt accounts and card identity. It SHALL accept only an explicit directed CLP debit and USD credit with distinct stable bank source identifiers, exact existing transfer-exclusion categories and one common reference. It SHALL refuse invalid evidence, missing categories, inactive accounts, duplicated sources, close amount matches or a mismatched prior audit. It SHALL NOT compute exchange rates, automatically discover conversions, or claim native cross-budget linkage. The entries are not consumption or income economically; existing category-based report filters apply only to configured widgets.

#### Scenario: Two statement-backed amounts
- **WHEN** the operator provides exact verified statement rows, supported accounts, categories and no duplicate in either budget
- **THEN** preview proposes both specified entries with shared reference and no exchange-rate calculation.

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
