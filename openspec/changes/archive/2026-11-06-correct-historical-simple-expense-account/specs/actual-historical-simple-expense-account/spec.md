## Purpose

Preserve and correctly assign historical simple expenses when full bank evidence identifies the true account.

## ADDED Requirements

### Requirement: Correct a historically misassigned simple expense safely
The system SHALL accept only an exact simple, non-transfer, non-reconciled and unowned historical expense between active accounts of the same budget, with an independently reviewed notice and complete statements for both accounts. The source statement must cover the purchase without the charge, and the destination statement must show the same charge. It MUST reject possible destination duplicates, preserve all fields except account, and verify both balances and all unrelated data after backup, synchronization and independent readback. A pending audit MUST prevent another write; a complete exact retry MUST only verify.

#### Scenario: One evidenced expense
- **WHEN** the transaction and evidence are complete, the accounts are active and no destination duplicate exists
- **THEN** the existing transaction moves without changing its identity or other fields, and the audit records a verified result

#### Scenario: Conflicting or incomplete evidence
- **WHEN** identity, statement provenance, account state, ledger ownership or duplicate checks fail
- **THEN** no transaction changes

#### Scenario: Interrupted write
- **WHEN** a previous attempt has a pending audit or an unexplained changed transaction
- **THEN** the system refuses to write and requires inspection of the backup and current state
