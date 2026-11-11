## Why

A verified merchant refund may settle in a wallet while the original purchase's category is unknown. Waiting for a classification leaves a confirmed bank credit out of the ledger and prevents accurate account balances.

## What Changes

- Permit an explicitly uncategorized purchase and its fully supported cross-account refund to remain linked and in Review without inventing a category.
- Add a paired category resolution that changes both linked entries and their ledger records together once the category is known.
- Protect both entries from one-sided category edits while the linked refund is pending.

## Capabilities

### New Capabilities

- `actual-linked-refund-category-resolution`: Safely resolve the category of a verified purchase and linked refund together.

### Modified Capabilities

- `actual-cross-account-statement-refunds`: Support an explicitly uncategorized linked refund while preserving Review and provenance.

## Impact

Actual daily adapter, ledger audits, Gmail Review state, test coverage and runbook. No bank transfer or payment is initiated.
