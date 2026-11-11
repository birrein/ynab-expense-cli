## Purpose

Correct evidence-proven duplicate expenses recorded in different Actual accounts while preserving financial provenance and preventing reimport.

## ADDED Requirements

### Requirement: Retire a wrong-account Gmail expense only with verified retained payment
The adapter SHALL allow a simple Gmail-owned expense to be retired only when the operator has independently verified its source emails, the payment document, bank statement and retained bank-owned cashflow identify the same payment and correct account. The adapter SHALL validate exact snapshots, unique ledger ownership and evidence references, distinct accounts, equal signed amount and category, nearby dates and absence of unsupported financial relationships; evidence identifiers alone SHALL NOT establish identity.

#### Scenario: Verified duplicate
- **WHEN** evidence and live data prove the same payment is duplicated in different accounts
- **THEN** the adapter preserves the correctly attributed bank expense, retires only the wrong-account expense and preserves original Gmail source lineage in a durable audit.

#### Scenario: Ambiguous, stale or unsupported data
- **WHEN** any identity, source ownership, account, amount, category, state or evidence requirement is missing or inconsistent
- **THEN** no financial change occurs.

### Requirement: Guard sources and recover financial mutations
The operation SHALL require an exclusive lease, durable backup, synchronized revalidation and pending audit before mutation, and independently verify the complete budget, exact balance effect and ledger before completion. It SHALL reserve all retired Gmail sources against subsequent writes and retain existing email labels; exact completed retries SHALL verify without writing. An incomplete intent SHALL block related financial mutations until independently inspected and recovered.

#### Scenario: Crash or retry
- **WHEN** a failure occurs after a write or a completed operation is retried
- **THEN** no second retirement or new expense is created, and the audit and backup permit investigation.

#### Scenario: Reimport of retired source
- **WHEN** any later candidate attempts to reuse a source belonging to the retired duplicate
- **THEN** the adapter refuses mutation and identifies the preserved bank expense as the resolution target.
