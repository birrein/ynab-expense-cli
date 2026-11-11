## MODIFIED Requirements

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
