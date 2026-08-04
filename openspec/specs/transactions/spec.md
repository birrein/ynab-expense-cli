# transactions Specification

## Purpose

Define how `ynab-expense` obtains, creates, and edits normal YNAB expense transactions while preserving the CLI's preview-first safety model.

## Requirements

### Requirement: Obtain normal transactions

The CLI SHALL obtain normal YNAB transactions through the `transactions` command and SHALL forward optional inclusive date filters to the YNAB client.

#### Scenario: Obtain transactions for a date range

- **WHEN** the user runs `ynab-expense transactions --budget budget-1 --since 2026-06-01 --until 2026-06-30`
- **THEN** the CLI obtains normal transactions for `budget-1` using the supplied date range
- **AND** the CLI prints YNAB's response

#### Scenario: Obtain transactions using the configured budget

- **WHEN** the user runs `ynab-expense transactions` without an explicit budget and a local default budget is configured
- **THEN** the CLI obtains normal transactions using the configured budget id

### Requirement: Preview and create normal expenses

The CLI SHALL preview normal expense creation without writing by default and SHALL create the transaction only when `--commit` is explicitly supplied.

#### Scenario: Preview a normal expense

- **WHEN** the user runs `ynab-expense add` with valid expense fields and without `--commit`
- **THEN** the CLI prints a dry-run transaction payload
- **AND** the payload uses negative YNAB milliunits for the expense
- **AND** the CLI does not write to YNAB

#### Scenario: Commit a normal expense

- **WHEN** the user runs `ynab-expense add` with valid expense fields and `--commit`
- **THEN** the CLI sends the normal transaction create payload to YNAB
- **AND** the CLI prints YNAB's response

#### Scenario: Dry-run and commit conflict

- **WHEN** the user supplies both `--dry-run` and `--commit`
- **THEN** the CLI returns an error and does not write to YNAB

### Requirement: Normal expense payload defaults

The CLI SHALL build deterministic expense payloads using resolved budget/account defaults, an audit memo marker, stable import ids, and safe initial transaction state.

#### Scenario: Use configured defaults

- **WHEN** the user runs `ynab-expense add` without explicit budget or account flags and corresponding local defaults are configured
- **THEN** the preview or committed payload uses the configured budget and account ids

#### Scenario: Build safe transaction defaults

- **WHEN** the CLI builds a new normal expense payload
- **THEN** the transaction is uncleared and unapproved
- **AND** its memo contains `source=ynab-expense-cli`
- **AND** its import id is stable for equivalent normalized input

### Requirement: Create normal transactions from files and splits

The CLI SHALL support normal simple and split expense creation from JSON files while preserving preview-first write safety.

#### Scenario: Preview a split expense file

- **WHEN** the user runs `ynab-expense add --file expense.json` with a valid split expense
- **THEN** the CLI prints a dry-run payload containing the subtransactions
- **AND** the parent transaction omits a single category
- **AND** the CLI does not write to YNAB

#### Scenario: File input cannot be mixed with detail flags

- **WHEN** the user combines `--file` with normal transaction detail flags
- **THEN** the CLI rejects the ambiguous input and does not write to YNAB

### Requirement: Preview and edit simple normal transactions

The CLI SHALL read the current normal transaction before previewing or committing a simple edit and SHALL patch only explicitly changed fields.

#### Scenario: Preview a simple edit

- **WHEN** the user runs `ynab-expense edit --id transaction-1 --memo "Updated"` without `--commit`
- **THEN** the CLI reads `transaction-1`
- **AND** the CLI prints the original transaction and the proposed patch
- **AND** the CLI does not write to YNAB

#### Scenario: Commit a simple edit

- **WHEN** the user runs a valid simple edit with `--commit`
- **THEN** the CLI reads and verifies the requested transaction id
- **AND** the CLI sends a patch containing only explicitly changed fields
- **AND** the CLI prints YNAB's response

#### Scenario: Mismatched fetched id is rejected

- **WHEN** YNAB returns a transaction whose id does not match the requested `--id`
- **THEN** the CLI returns an error and does not send the patch

### Requirement: Replace split normal transactions safely

The CLI SHALL handle split transaction edits through explicit replacement and SHALL create the replacement before deleting the original transaction.

#### Scenario: Preview split replacement

- **WHEN** the user runs `ynab-expense edit --id transaction-1 --file corrected.json --replace-split` without `--commit`
- **THEN** the CLI reads the original transaction
- **AND** the CLI prints the original transaction and replacement payload
- **AND** the CLI does not create or delete a transaction

#### Scenario: Commit split replacement

- **WHEN** the user commits a valid split replacement
- **THEN** the CLI creates the replacement before deleting the original transaction
- **AND** a failed replacement creation leaves the original transaction intact

#### Scenario: Original deletion failure is recoverable

- **WHEN** replacement creation succeeds but deleting the original transaction fails
- **THEN** the CLI reports both transaction ids for manual recovery

### Requirement: Normal transaction flag color option

The CLI SHALL expose an optional `--flag-color` option on normal `add` and `edit` commands and SHALL include the supplied value as `flag_color` in the normal YNAB transaction payload.

#### Scenario: Normal add previews a flag color

- **WHEN** the user runs `ynab-expense add` with valid expense fields, `--flag-color purple`, and `--dry-run`
- **THEN** the dry-run transaction payload contains `flag_color: "purple"`
- **AND** the command does not write to YNAB

#### Scenario: Normal edit previews a flag color

- **WHEN** the user runs `ynab-expense edit --id transaction-1 --flag-color purple --dry-run`
- **THEN** the CLI reads the existing transaction and prints a patch containing `flag_color: "purple"`
- **AND** the command does not write to YNAB

#### Scenario: Omitted flag color preserves current normal behavior

- **WHEN** the user runs normal `add` or `edit` without `--flag-color`
- **THEN** the generated create or patch payload omits `flag_color`

### Requirement: Normal transaction flag writes require explicit commit

The CLI SHALL write a normal transaction flag color only when the corresponding `add` or `edit` command is run with `--commit`.

#### Scenario: Normal edit commits the flag color

- **WHEN** the user runs `ynab-expense edit --id transaction-1 --flag-color purple --commit`
- **THEN** the CLI sends a normal transaction patch containing `flag_color: "purple"`
- **AND** the CLI prints YNAB's response

#### Scenario: Normal add commits the flag color

- **WHEN** the user runs `ynab-expense add` with valid expense fields, `--flag-color purple`, and `--commit`
- **THEN** the CLI sends a normal transaction create payload containing `flag_color: "purple"`
- **AND** the CLI prints YNAB's response
