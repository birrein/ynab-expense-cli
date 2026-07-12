## ADDED Requirements

### Requirement: Scheduled command group
The CLI SHALL expose scheduled transaction operations under a `scheduled` command group without changing the behavior of the existing normal transaction commands.

#### Scenario: Scheduled transactions can be obtained
- **WHEN** the user runs `ynab-expense scheduled`
- **THEN** the CLI obtains scheduled transactions from YNAB and prints JSON

#### Scenario: Scheduled add help is available
- **WHEN** the user runs `ynab-expense scheduled add --help`
- **THEN** the CLI shows help for creating a scheduled transaction

#### Scenario: Existing add remains normal
- **WHEN** the user runs `ynab-expense add` with normal transaction flags
- **THEN** the CLI continues to build a normal transaction payload for `/transactions`

### Requirement: Obtain scheduled transactions
The CLI SHALL obtain scheduled transactions through the scheduled transaction API and SHALL support date filter flags that mirror the regular `transactions` command.

#### Scenario: Obtain all scheduled transactions
- **WHEN** the user runs `ynab-expense scheduled --budget default`
- **THEN** the CLI sends `GET /plans/default/scheduled_transactions`
- **AND** the CLI prints the raw YNAB response body

#### Scenario: Obtain scheduled transactions using configured default budget
- **WHEN** the user runs `ynab-expense scheduled` and a local default budget is configured
- **THEN** the CLI sends the scheduled transactions request using the configured budget id

#### Scenario: Filter scheduled transactions by next date
- **WHEN** the user runs `ynab-expense scheduled --since 2026-08-01 --until 2026-08-31`
- **THEN** the CLI obtains scheduled transactions from YNAB
- **AND** the CLI prints only scheduled transactions whose `date_next` is within the inclusive filter range

#### Scenario: Invalid scheduled filter date is rejected
- **WHEN** the user runs `ynab-expense scheduled --since not-a-date`
- **THEN** the CLI returns an error explaining that date filters must be `YYYY-MM-DD`
- **AND** the CLI does not call YNAB

### Requirement: Create scheduled transaction dry-run
The CLI SHALL create a dry-run preview for `scheduled add` by default without requiring a YNAB token.

#### Scenario: Preview scheduled expense
- **WHEN** the user runs `ynab-expense scheduled add --account-id account-1 --amount 23332 --currency CLP --payee "Mercado Libre" --date 2026-08-23 --category-id category-1 --memo "Mouse 2/6"`
- **THEN** the CLI prints JSON with `dry_run: true`, the resolved budget, and a `scheduled_transaction` payload
- **AND** the payload amount is negative YNAB milliunits
- **AND** the payload memo includes `source=ynab-expense-cli`

#### Scenario: Preview uses configured defaults
- **WHEN** the user runs `ynab-expense scheduled add --amount 23332 --payee "Mercado Libre" --date 2026-08-23` and local budget/account defaults are configured
- **THEN** the preview uses the configured budget and account id

### Requirement: Create scheduled transaction commit
The CLI SHALL create scheduled transactions only when `--commit` is present.

#### Scenario: Commit scheduled expense
- **WHEN** the user runs `ynab-expense scheduled add` with valid fields and `--commit`
- **THEN** the CLI sends `POST /plans/{plan_id}/scheduled_transactions`
- **AND** the request body contains a top-level `scheduled_transaction` object
- **AND** the CLI prints the raw YNAB response body

#### Scenario: Dry-run and commit conflict
- **WHEN** the user runs `ynab-expense scheduled add --dry-run --commit`
- **THEN** the CLI returns an error and does not call YNAB

### Requirement: Scheduled transaction date validation
The CLI SHALL validate scheduled transaction dates before writing or previewing a scheduled transaction payload.

#### Scenario: Non-future date is rejected
- **WHEN** the user runs `ynab-expense scheduled add --date` with today or a past date
- **THEN** the CLI returns an error explaining that scheduled transaction dates must be future dates
- **AND** the CLI does not call YNAB

#### Scenario: Date beyond YNAB range is rejected
- **WHEN** the user runs `ynab-expense scheduled add --date` with a date more than five years in the future
- **THEN** the CLI returns an error explaining that scheduled transaction dates must be no more than five years in the future
- **AND** the CLI does not call YNAB

#### Scenario: Invalid date format is rejected
- **WHEN** the user runs `ynab-expense scheduled add --date not-a-date`
- **THEN** the CLI returns an error explaining that `--date` must be `YYYY-MM-DD`
- **AND** the CLI does not call YNAB

### Requirement: Scheduled frequency validation
The CLI SHALL support only known YNAB scheduled transaction frequency values.

#### Scenario: Default one-off frequency
- **WHEN** the user runs `ynab-expense scheduled add` without `--frequency`
- **THEN** the preview or committed payload uses `frequency: "never"`

#### Scenario: Supported recurring frequency
- **WHEN** the user runs `ynab-expense scheduled add --frequency monthly` with otherwise valid fields
- **THEN** the preview or committed payload uses `frequency: "monthly"`

#### Scenario: Unsupported frequency rejected
- **WHEN** the user runs `ynab-expense scheduled add --frequency sometimes`
- **THEN** the CLI returns an error listing or describing the supported frequency values
- **AND** the CLI does not call YNAB

### Requirement: Scheduled transaction create field validation
The CLI SHALL require the fields needed to create an expense-oriented scheduled transaction and SHALL reject unsupported split input.

#### Scenario: Missing amount is rejected
- **WHEN** the user runs `ynab-expense scheduled add --account-id account-1 --payee "Store" --date 2026-08-23`
- **THEN** the CLI returns an error that `--amount` is required

#### Scenario: Missing payee is rejected
- **WHEN** the user runs `ynab-expense scheduled add --account-id account-1 --amount 1000 --date 2026-08-23`
- **THEN** the CLI returns an error that `--payee` is required

#### Scenario: Split file input is rejected
- **WHEN** the user runs `ynab-expense scheduled add --file expense.json`
- **THEN** the CLI returns an error that scheduled file input is not supported in this change

### Requirement: Edit scheduled transaction dry-run
The CLI SHALL read an existing scheduled transaction before previewing scheduled transaction edits.

#### Scenario: Preview scheduled edit
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --memo "Updated memo"`
- **THEN** the CLI fetches `GET /plans/{plan_id}/scheduled_transactions/scheduled-1`
- **AND** the CLI prints JSON with `dry_run: true`, `operation: "scheduled_edit"`, `before`, and the full update `payload`
- **AND** the CLI does not write to YNAB

#### Scenario: Scheduled edit dry-run requires token
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --memo "Updated memo"` without a configured token
- **THEN** the CLI returns the normal missing-token error

### Requirement: Edit scheduled transaction commit
The CLI SHALL update scheduled transactions only when `--commit` is present.

#### Scenario: Commit scheduled edit
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --memo "Updated memo" --commit`
- **THEN** the CLI fetches the current scheduled transaction
- **AND** the CLI sends `PUT /plans/{plan_id}/scheduled_transactions/scheduled-1`
- **AND** the request body contains a full `scheduled_transaction` object with the changed memo and preserved unchanged fields
- **AND** the CLI prints the raw YNAB response body

#### Scenario: Mismatched fetched id is rejected
- **WHEN** YNAB returns a scheduled transaction whose id does not match `--id`
- **THEN** the CLI returns an error and does not send the update request

### Requirement: Scheduled edit field merge
The CLI SHALL merge scheduled edit flags over the fetched scheduled transaction before previewing or committing the update.

#### Scenario: Amount edit uses expense parsing
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --amount 23332 --currency CLP`
- **THEN** the update payload amount is `-23332000`
- **AND** unchanged fetched fields are preserved

#### Scenario: Payee edit uses payee name
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --payee "New Payee"`
- **THEN** the update payload sends `payee_name: "New Payee"`
- **AND** the update payload does not send the previously fetched `payee_id`

#### Scenario: Date edit is validated
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --date` with today or a past date
- **THEN** the CLI returns an error and does not send the update request

### Requirement: Scheduled split edits rejected
The CLI SHALL reject editing scheduled split transactions in this change.

#### Scenario: Fetched scheduled split is rejected
- **WHEN** the user runs `ynab-expense scheduled edit --id scheduled-1 --memo "Updated"` and the fetched scheduled transaction contains subtransactions
- **THEN** the CLI returns an error explaining that scheduled split edits are not supported
- **AND** the CLI does not send the update request
