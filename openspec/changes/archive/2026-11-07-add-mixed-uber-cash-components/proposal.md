## Why

Several receipts document a single ride paid partly by card and partly by Uber Cash. The card expense already owns the receipt, so the ordinary duplicate guard treats a wallet candidate as an existing transaction and cannot represent the missing portion.

## What Changes

- Permit a narrowly audited addition of the missing wallet component for a verified shared receipt, keeping the existing card expense and source ledger unchanged.
- Bind the exact card and ledger snapshots, receipt, statement, wallet, amounts, full budget and stable ledger to a plan digest. Block and investigate interrupted writes.
- Verify both components, absence of duplicates, unrelated state and balances using an independent download. Do not infer wallet opening balances or reward dates.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-partial-uber-cash-reconstruction`: Support an existing partial wallet and an existing mixed-payment source without recreating the initial group.

## Impact

Actual reconciliation adapter, tests and operational runbook. No other budgets, labels or existing financial records are modified by this operation.
