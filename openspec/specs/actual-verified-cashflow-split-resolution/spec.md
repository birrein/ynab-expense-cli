# actual-verified-cashflow-split-resolution Specification

## Purpose
Resolve verified, previously uncategorized bank-sourced expenses into evidence-backed category splits without duplicating transactions or losing their provenance.

## Requirements

### Requirement: Resolve a verified cashflow expense into a split
The system SHALL accept only an exact verified ledger-owned uncategorized simple expense in an active account, with distinct active categories and integer split amounts that sum to the existing transaction. It SHALL require evidence and preview, lease and lock, backup, revalidation, official API write, sync, independent full snapshot verification, and a durable idempotent audit. It SHALL preserve the parent identity, amount, account, date, payee, imported source ID, source URLs, and all unrelated transactions, balances and budget data; it SHALL update the cashflow ledger without discarding provenance.

#### Scenario: Evidence supports the split
- **WHEN** a verified existing expense and an evidenced balanced split pass all checks
- **THEN** the system converts the existing transaction to that split, verifies its children and updates its audit and ledger without changing balances

#### Scenario: Conflicting identity or evidence
- **WHEN** transaction, ledger, account, source, category, amounts, or unrelated state do not match
- **THEN** the system refuses to apply the operation

#### Scenario: Repeated application
- **WHEN** the identical verified operation is retried
- **THEN** the system returns its audit without another write
