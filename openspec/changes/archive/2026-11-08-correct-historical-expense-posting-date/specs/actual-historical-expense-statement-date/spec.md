## Purpose
Safely correct bank posting dates for individually evidenced historical expenses without adding or duplicating a transaction.

## ADDED Requirements

### Requirement: Correct the statement posting date of one historical expense
The adapter SHALL accept exactly one complete snapshot of a simple negative non-reconciled historical expense without imported source, ledger ownership, schedule or transfer, an active account, an independently reviewed receipt, and a single complete bank statement covering both the receipt and the previous and new transaction dates. The new date SHALL be one to four days after the old date; the receipt date SHALL equal the old date or be one day earlier. The operator SHALL verify the account, recipient, amount, transaction identity, actual posting and lack of competing payments. The adapter SHALL reject mismatched snapshots, unsupported dates, conflicting or already-used sources, and nearby equal-amount expenses. It SHALL bind a preview hash to candidate, full budget, dashboards and stable ledger and SHALL preserve the ID, category, notes, amount, other fields and final balances.

#### Scenario: Receipt and statement identify an existing expense
- **WHEN** a bank receipt and covering statement uniquely identify the same existing expense and its later posting date
- **THEN** the adapter previews and verifies only its date change.

#### Scenario: Evidence does not uniquely identify the expense
- **WHEN** a receipt, source, date, account, recipient, amount, snapshot or nearby transaction conflicts
- **THEN** the adapter refuses to write.

### Requirement: Protect expense date correction with durable independent verification
The adapter SHALL require an exact preview hash and lease, back up and revalidate before storing a pending audit and writing, and independently download and compare the entire budget and daily balances before completing the audit. A pending audit SHALL block other financial mutations. An exact completed retry SHALL verify without another write.

#### Scenario: An update is interrupted
- **WHEN** a write or independent readback fails after intent is saved
- **THEN** the pending audit and backup remain and subsequent financial writes are blocked.
