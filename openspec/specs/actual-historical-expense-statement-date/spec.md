# actual-historical-expense-statement-date Specification

## Purpose
Safely correct bank posting dates for individually evidenced historical expenses without adding or duplicating a transaction.

## Requirements

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

### Requirement: Correct a manually entered expense date from matching evidence
The adapter SHALL allow an explicitly selected correction of an eligible categorized historical expense by one to seven days forward when an independently inspected receipt and complete covering statement agree on the new transaction date, account, recipient and amount. It SHALL retain all source ownership, competing expense, full snapshot, lease, backup, pending-audit and independent readback safeguards.

#### Scenario: Receipt and bank posting agree
- **WHEN** a receipt and covering statement uniquely establish that the expense occurred six days after its manual date
- **THEN** the adapter previews and verifies a date-only correction.

#### Scenario: Ambiguous or incomplete evidence
- **WHEN** proof is missing, dates or accounts conflict, a competing expense exists, the mode is absent or any other control fails
- **THEN** no write is permitted.

### Requirement: Correct an independently evidenced earlier expense posting
The adapter SHALL accept an explicit earlier-expense mode for an eligible simple categorized historical expense when an independently inspected receipt and one complete statement uniquely establish the posting. The new date SHALL be one to four days earlier than the historical date, the receipt date SHALL equal the new date, and the statement SHALL cover the receipt and both transaction dates. The operator SHALL verify the recipient, account, amount, identity, actual posting and absence of competing expenses. All existing source ownership, snapshot, daily balance preview, hash, lease, backup, pending audit and independent verification safeguards SHALL apply.

#### Scenario: Earlier cheque posting is proven
- **WHEN** a bank notice and covering statement uniquely identify the same categorized expense posted one day before its historical date
- **THEN** the adapter previews and independently verifies only the date correction.

#### Scenario: Evidence is missing or conflicts
- **WHEN** the explicit mode, receipt, coverage or identity is missing or inconsistent, or another safety control fails
- **THEN** no mutation is permitted.
