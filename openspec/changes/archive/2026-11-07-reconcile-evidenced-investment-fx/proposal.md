## Why

A verified investment withdrawal moved cash from a USD investment account through conversion into a CLP investment account and then the user's bank. The budgets are separate and the current debt-specific conversion cannot represent this direction without mislabeling income or expenses.

## What Changes

- Support an operator-directed, statement-evidenced conversion from an existing USD cash account to an existing CLP cash account using the exact amounts explicitly shown by the providers, and a separate native transfer to the bank.
- Preserve reporting meaning with purpose-specific transfer categories and verify the affected report filters before recording; retain the limitations of other reports.
- Require both budget backups, lease, pending audit, duplicate checks, complete independent readback and safe interruption handling.
- Never infer an exchange rate, automatically discover transactions, rewrite prior investments, or claim the two budget entries are a native transfer.

## Capabilities

### New Capabilities

- `actual-evidenced-investment-currency-conversion`: Record explicitly evidenced cross-budget investment currency conversions safely and distinguish them from economic income and expense.

### Modified Capabilities

None.

## Impact

Actual daily adapter, official Actual API, both configured budgets, dedicated transfer categories, affected report filters and reconciliation notes. Historical investments and unrelated accounts remain unchanged.
