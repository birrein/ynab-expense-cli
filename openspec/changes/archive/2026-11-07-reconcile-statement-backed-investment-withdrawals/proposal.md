## Why

Verified own-account investment withdrawals appear in bank statements but cannot be registered as native transfers because their origin account is absent from Actual. Treating them as ordinary income would distort financial analysis; inventing an opening balance or duplicating existing transactions would misstate assets.

## What Changes

- Permit narrowly verified creation of an on-budget investment cash account using a dated, documented statement checkpoint and an Actual starting-balance transaction, with backup, lease, durable pending audit, and independent readback.
- Reuse the existing evidenced native-transfer workflow to register a withdrawal confirmed on both sides; preserve source provenance and prevent duplicates or retries after a partial write.
- Document the limitations of a checkpoint: it is not a reconstruction of earlier investment performance or a taxable gain, and it cannot be used without inspecting the underlying account statement.
- Do not infer exchange rates or represent cross-currency conversions as native same-currency transfers. Any later multi-currency work requires separate safeguards and evidence.

## Capabilities

### New Capabilities

- `actual-statement-backed-investment-opening`: Audited, dated creation of an investment cash account from an independently verified statement checkpoint.

### Modified Capabilities

None.

## Impact

Actual CLI adapter, policy, tests, runbook, and private ledger. Uses the existing official Actual API, existing CLP/USD budgets and existing native-transfer safeguards. No bank-side transactions or changes to YNAB.
