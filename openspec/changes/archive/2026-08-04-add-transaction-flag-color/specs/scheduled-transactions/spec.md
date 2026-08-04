# scheduled-transactions Specification Delta

## ADDED Requirements

### Requirement: Scheduled transaction flag color option

The CLI SHALL expose an optional `--flag-color` option on `scheduled add` and `scheduled edit` and SHALL include the supplied value as `flag_color` in the scheduled YNAB transaction payload.

#### Scenario: Scheduled add previews a flag color

- **WHEN** the user runs `ynab-expense scheduled add` with valid fields, `--flag-color purple`, and `--dry-run`
- **THEN** the scheduled transaction payload contains `flag_color: "purple"`
- **AND** the command does not write to YNAB

#### Scenario: Scheduled edit previews a flag color

- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --flag-color purple --dry-run`
- **THEN** the CLI reads the existing scheduled transaction and prints a full update payload containing `flag_color: "purple"`
- **AND** the command does not write to YNAB

#### Scenario: Scheduled edit preserves an existing flag when omitted

- **WHEN** the user edits a scheduled transaction without `--flag-color`
- **THEN** the full update payload preserves the fetched `flag_color`

### Requirement: Scheduled transaction flag color writes require explicit commit

The CLI SHALL write a scheduled transaction flag color only when the corresponding `scheduled add` or `scheduled edit` command is run with `--commit`.

#### Scenario: Scheduled edit commits the flag color

- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --flag-color purple --commit`
- **THEN** the CLI sends a full scheduled transaction update containing `flag_color: "purple"`
- **AND** the CLI prints YNAB's response

#### Scenario: Scheduled add commits the flag color

- **WHEN** the user runs `ynab-expense scheduled add` with valid fields, `--flag-color purple`, and `--commit`
- **THEN** the CLI sends a scheduled transaction create payload containing `flag_color: "purple"`
- **AND** the CLI prints YNAB's response
