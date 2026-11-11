## Purpose

Keep descriptions on verified split children accurate without changing financial identity, values or sources.

## ADDED Requirements

### Requirement: Amend one verified child description
The adapter SHALL require the exact complete source-ledger-owned parent and children, their verified ledger records, one child ID, an exact descriptive replacement and evidence. It SHALL prohibit editing links, hashtags, source metadata or other fields. It SHALL preview, require exclusive lease and lock, back up, revalidate, sync, independently verify the full budget and unchanged balances, and preserve an idempotent audit. Stale or unaudited partial states SHALL stop.

#### Scenario: One stale child note
- **WHEN** the verified child has a stale description and the exact split and ledger match
- **THEN** the adapter changes only that description and preserves the parent and all other child fields.

#### Scenario: Unsafe or repeated operation
- **WHEN** source metadata would change or live state conflicts
- **THEN** the adapter rejects the write; an identical audited retry verifies without writing.
