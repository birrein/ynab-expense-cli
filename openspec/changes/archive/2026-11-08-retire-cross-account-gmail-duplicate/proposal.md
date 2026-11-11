## Why

A bank-confirmed payment can be recorded once from Gmail in the wrong account and again from the actual bank statement in the correct account. This doubles expenses and corrupts the credit-card balance; ordinary removal drops Gmail source records and allows reimport.

## What Changes

- Add an evidence-bound, auditable operation to retire a Gmail-linked duplicate in a different account while preserving a bank-verified cashflow.
- Reserve every original Gmail source against reimport and retain exact source, transaction, account, and evidence history.
- Validate identity, backups, an exclusive lease, independent readback, crash handling and retries without modifying unrelated transactions or the retained bank entry.

## Capabilities

### New Capabilities

- `actual-cross-account-gmail-expense-dedup`: retire a documented wrong-account Gmail duplicate of an existing verified bank expense while preserving source lineage.

### Modified Capabilities

None.

## Impact

The Actual-only Node adapter, its tests, source ledger policy and operator runbook. No bank, budget, schedule or Gmail changes are implied by implementation alone.
