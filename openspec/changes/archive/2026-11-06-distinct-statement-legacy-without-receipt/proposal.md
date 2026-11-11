## Why

A settled statement row can be blocked by a same-amount legacy movement on a different date. A complete statement may establish both rows even when the older manually entered movement has useful descriptive notes but no separately retrievable receipt or payee.

## What Changes

- Add a narrowly scoped, audited exception for an exact legacy transaction with descriptive notes and a complete shared statement independently inspected for two different dated merchant rows.
- Retain normal duplicate detection, provenance, lease, backup, revalidation and independent readback; do not infer evidence from supplied identifiers or descriptors.
- Keep existing receipt-backed exceptions unchanged and allow the new charge to remain uncategorized with a review reason.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-confirmed-cashflows`: recognize a separately evidenced legacy statement row without inventing a receipt, under stricter identity constraints.

## Impact

Changes the cashflow classifier and audit, its tests, and the Actual runbook. It does not modify prior transactions, Gmail labels, budgets, or any source until an independently reviewed plan is applied.
