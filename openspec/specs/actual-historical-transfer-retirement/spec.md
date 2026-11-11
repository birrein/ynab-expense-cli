# actual-historical-transfer-retirement Specification

## Purpose
Safely retire an unsupported historical transfer from two independently checked accounts without changing unrelated budget data.

## Requirements

### Requirement: Evidence-bound historical transfer retirement
The adapter SHALL accept only a precisely identified unimported, unlinked, unreconciled pair of reciprocal transfer legs, supported by two distinct verified bank statements covering the specified date and accounts. It SHALL require a preview, active lease and lock, backup, unchanged pre-write snapshot, synchronization, independent readback of both account balances and every unrelated item, and a durable audit.

#### Scenario: Historical pair conflicts with both verified statements
- **WHEN** both statement sources, recorded identities, date, amounts, accounts and reciprocal links match the reviewed candidate and neither statement contains the transfer
- **THEN** the adapter retires both legs once and verifies the balance changes and preservation of unrelated data.

#### Scenario: Identity or evidence conflict
- **WHEN** a leg is reconciled, scheduled, imported, source-linked, has notes, has a split, is missing or differs from the reviewed identity, or either independent statement is missing
- **THEN** the adapter rejects the candidate without financial mutation.

#### Scenario: Retry after a completed write
- **WHEN** the exact candidate is retried after verified retirement
- **THEN** the adapter checks the recorded audit and absence of both legs and does not write again.

#### Scenario: Interrupted write
- **WHEN** the pair is absent or partially present without a matching completed audit
- **THEN** the adapter refuses further mutations and reports recovery is necessary using the preserved backup.
