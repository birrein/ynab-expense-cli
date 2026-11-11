## Why

Card refinancing reverses an existing card balance and introduces a debt repaid through billed installments. Treating the installments as new purchases duplicates principal, while reminders alone do not represent posted transactions or interest.

## What Changes

- Add a source-backed, reviewable operation for recording a card refinancing, its debt account, principal transfers, and billed interest without duplicating previous purchases.
- Require explicit original statements, dated installment evidence, arithmetic validation, and a clear distinction between bank-stated amounts and inferred amortization.
- Preserve future non-posting reminders, existing transactions, other accounts, labels, and automation checkpoints; require backup, lease, synchronization, independent verification, and safe partial-write recovery.

## Capabilities

### New Capabilities

- `actual-card-refinancing`: Record and verify the conversion of existing card debt to a separately tracked refinancing and the principal and interest of billed installments.

### Modified Capabilities

None.

## Impact

The Actual adapter and Go CLI integration, local reconciliation audit, and runbook. The operation affects only the explicitly selected Actual budget and accounts, and uses the existing official API bridge.
