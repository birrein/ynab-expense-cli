# actual-same-day-statement-expenses Specification

## Purpose
Safely distinguish separate statement-backed merchant charges of the same amount on the same date without weakening duplicate checks.

## Requirements

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

### Requirement: Distinguish two identical billed rows using full statement totals

The adapter SHALL permit exactly one second expense with the same date, account, amount and merchant as a verified prior source only when the operator independently inspects two statement rows and a full statement arithmetic reconciliation corroborates both. The candidate SHALL bind stable distinct row ordinals and the exact prior snapshot and ledger, the same statement and amounts, and a bounded rounding discrepancy. Omitting one row MUST fail that same reconciliation tolerance. The adapter SHALL require all other duplicate, source, lease, backup, verification and audit safeguards. A confirmed expense MAY remain uncategorized with an explicit review reason. An additional nearby match MAY be accepted only when exactly one separate, different merchant row on the same date, account, amount and shared statement has an exact snapshot, a verified independent ledger source, distinct merchant and source, and evidence examined by the operator; no other match is allowed.

#### Scenario: Two billed rows
- **WHEN** two identical rows and the complete statement totals are inspected and a single prior row is verified in the ledger
- **THEN** plan proposes the second source and commit verifies it without altering the first.

#### Scenario: A separate verified same-day merchant
- **WHEN** two identical rows and a separate third row at another merchant are inspected, all prior matches and sources are verified and statement totals corroborate both identical rows
- **THEN** plan proposes the second identical source while preserving both existing transactions.

#### Scenario: Insufficient evidence or extra match
- **WHEN** either row, prior ledger, unique ordinal, arithmetic corroboration or statement identity is inconsistent, a separate match is not independently verified, or any further nearby match exists
- **THEN** no financial write occurs.

#### Scenario: Idempotent second-row retry
- **WHEN** the exact successful candidate is retried
- **THEN** the existing source is verified and no new expense is created.
