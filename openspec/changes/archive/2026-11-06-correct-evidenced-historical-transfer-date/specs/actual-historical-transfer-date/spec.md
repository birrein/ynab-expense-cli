## Purpose

Correct an evidenced date of a historical linked own-account transfer without creating another transaction.

## ADDED Requirements

### Requirement: Correct both legs of an evidenced transfer date
The adapter SHALL require exact full snapshots of reciprocal simple unreconciled unowned legs, active accounts, independently reviewed receipt and statement, and an unambiguous correction of exactly one day within the same month. It SHALL preserve both IDs, all non-date fields, cleared flags, account balances and unrelated data.

#### Scenario: Exact proven payment
- **WHEN** both legs, accounts, amounts, date and inspected evidence match with no competing pair
- **THEN** preview proposes updating both dates without creating a transfer.

#### Scenario: Missing evidence or conflicting pair
- **WHEN** a snapshot, statement, receipt, account, date or nearby match conflicts
- **THEN** the operation fails without writing.

### Requirement: Audit interrupted and completed updates
The adapter SHALL back up, revalidate and persist a pending audit before updating; it SHALL independently verify the full result before completing the audit. A pending audit SHALL block retries and an identical complete retry SHALL only verify.

#### Scenario: Interrupted update
- **WHEN** either update or readback fails
- **THEN** the pending audit and backup remain available and subsequent automatic mutation is blocked.
