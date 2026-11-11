## Purpose

Represent an independently documented historical investment cash checkpoint as an Actual account without manufacturing consumption or ordinary earned income.

## ADDED Requirements

### Requirement: Create a documented historical opening account

The adapter SHALL accept only a unique account, explicit currency, real date, integer statement-backed opening balance, stable source and explanatory evidence. The operator MUST independently inspect the statement. Preview SHALL make the checkpoint, reporting treatment and limitations visible. Apply SHALL require the owning lease and lock, backup, pending audit, snapshot revalidation, and native starting-balance semantics, with the documented date and source. It SHALL synchronize and independently verify the account, transfer payee, opening transaction, balances and unchanged unrelated budget data.

#### Scenario: Verified statement checkpoint
- **WHEN** the checkpoint and account are evidenced, the budget is unchanged, and no account or audit collision exists
- **THEN** exactly one account with exactly one correctly dated native starting-balance entry is created and independently verified.

#### Scenario: Invalid, ambiguous, or duplicate account
- **WHEN** a source, amount, date, unique account identity or evidence is missing, conflicts with an existing account, or the operator cannot confirm the statement checkpoint
- **THEN** no mutation occurs.

#### Scenario: Complete retry and interrupted write
- **WHEN** the exact completed operation is retried
- **THEN** the existing audited account is verified without another write; a pending or conflicting audit fails closed and requires investigation.
