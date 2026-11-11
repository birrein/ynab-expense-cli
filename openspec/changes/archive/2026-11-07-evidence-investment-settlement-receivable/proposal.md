## Why

An investment redemption can create a documented fiat receivable before it reaches a bank account even when the investment provider does not supply a fiat cash statement. The existing investment checkpoint only permits an evidenced cash balance; calling the redemption a cash balance or earned income would misrepresent it.

## What Changes

- Add an audited, evidence-gated historical checkpoint for a settlement receivable, distinct from a cash account and explicitly limited to a supported net amount due.
- Preserve native starting-balance semantics, report-filter safeguards, source identity, independent readback and fail-closed recovery.
- Reuse the existing same-currency transfer operation to settle the receivable against an independently verified bank credit.
- State explicitly that neither the checkpoint nor settlement reconstructs the investment's prior cost, promotion, other assets, income, or investment return.

## Capabilities

### New Capabilities

- `actual-evidenced-investment-settlement-receivable`: A net investment-redemption receivable checkpoint with documented settlement evidence and protected reporting semantics.

### Modified Capabilities

None.

## Impact

Actual adapter and policy, directed-run documentation, tests, and a new ledger audit family. No changes to remote application configuration or unrelated budgets.
