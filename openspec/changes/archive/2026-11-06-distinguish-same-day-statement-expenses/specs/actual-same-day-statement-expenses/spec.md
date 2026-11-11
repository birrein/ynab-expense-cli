## Purpose

Safely distinguish separate statement-backed merchant charges of the same amount on the same date without weakening duplicate checks.

## ADDED Requirements

### Requirement: Distinguish two verified same-day merchant rows
The adapter SHALL permit an explicitly evidenced expense matching a single prior expense on account, date and amount only when the operator has independently inspected a shared statement with two distinct merchant rows. The candidate SHALL contain the prior exact snapshot, distinct merchant descriptions, a verified prior ledger source and the shared statement. The adapter SHALL preserve all prior records and existing source, lease, backup, sync, audit and independent verification controls. The candidate MAY remain uncategorized with an explicit review reason.

#### Scenario: One separately verified same-day charge
- **WHEN** exactly one matching prior expense is supported by a verified ledger entry and shared statement and the operator confirms distinct merchant rows
- **THEN** plan proposes one new expense and commit verifies and audits it without altering the prior transaction.

#### Scenario: Ambiguous or unverified row
- **WHEN** another match exists, a descriptor or source conflicts, the prior snapshot or ledger differs, or required evidence is missing
- **THEN** plan returns Review and performs no financial write.

#### Scenario: Retry same source
- **WHEN** a successful candidate is retried unchanged
- **THEN** the adapter verifies the existing source and creates no duplicate.
