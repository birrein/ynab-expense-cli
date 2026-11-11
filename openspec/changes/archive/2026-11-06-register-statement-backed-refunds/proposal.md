## Why

Some settled refunds appear in verified bank statements without an associated merchant email. Recording only the net purchase misstates the daily account balance, while treating a bank statement as a manual source would obscure provenance.

## What Changes

- Permit a statement-backed refund of an existing verified simple expense, preserving its original date and category and linking a separately dated credit.
- Require an unused stable statement source, exact ledger identity and independently evidenced amount, date and account.
- Preserve fail-closed duplicate, lease, backup, sync, independent verification and audit controls.

## Capabilities

### New Capabilities

- `actual-statement-backed-refunds`: Record and verify statement-backed refunds of simple, ledger-owned expenses.

### Modified Capabilities

None.

## Impact

The local Actual adapter, its tests and operational documentation. No new dependency or remote budget is introduced.
