## Purpose
Provide one Go CLI entry point to the existing Actual adapter and safely post statement-confirmed installment schedules.

## ADDED Requirements

### Requirement: Actual commands through the Go CLI
The CLI SHALL expose Actual adapter operations without changing YNAB commands, invoking the pinned official Actual API runtime through the existing adapter. It MUST preserve argument boundaries, exit codes, stdout and stderr without exposing secrets.

#### Scenario: Preview through the CLI
- **WHEN** a user invokes an Actual preview command with a candidate file
- **THEN** the CLI returns the same preview and exit status as the existing adapter without writing.

### Requirement: Verified installment posting
The system SHALL accept one exact scheduled installment with its account, payee, date, scheduled amount, actual billed amount, category, original schedule and rule identity, stable per-installment source and supporting evidence. It MUST reject unmatched amounts, incomplete identity, duplicate or already linked transactions and conflicting schedules. It MUST NOT create a second charge on retries.

#### Scenario: Matched scheduled installment
- **WHEN** a uniquely identified billed installment matches an unpaid schedule and no matching posted transaction exists
- **THEN** preview proposes one transaction linked to that schedule without mutation.

#### Scenario: Mismatched amount
- **WHEN** the billed amount differs from the scheduled amount
- **THEN** preview rejects the candidate for review.

### Requirement: Safe writing and independent verification
A committed posting SHALL require the owning lease and exclusive lock, create a private backup before writing, synchronize, download independently and verify transaction, schedule association, amount, category, other transactions and balances. The operation SHALL retain a durable audit and recover the exact same candidate after interrupted writes without creating another transaction.

#### Scenario: Verified commit
- **WHEN** a valid preview is committed under the owning lease
- **THEN** exactly one linked transaction appears in the independent readback and all unrelated financial fields remain unchanged.

#### Scenario: Competing lease or mismatched readback
- **WHEN** the lease is absent or a write fails verification
- **THEN** the system reports failure and does not claim success or silently retry as a new charge.
