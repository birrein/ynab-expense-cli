## Why

A canceled marketplace sale can release proceeds, temporarily hold available funds, and later refund the buyer. Posting only its final fee makes monthly balances appear correct while intermediate account balances and income reports remain wrong.

## What Changes

- Add an evidence-gated operation to reconstruct a specific canceled sale from independent provider releases, claim evidence, statements and existing verified charges.
- Represent the temporary hold as a reciprocal transfer to a dedicated, zero-opening own holding account, and its release as the reverse transfer; represent sale and settlement reversals in a dedicated canceled-sale income category and exclude it from sign-based dashboard totals.
- Preserve existing fees, identities and provenance; use stable sources, preview, lease, lock, backup, pending audit, revalidation, independent readback and safe retry.

## Capabilities

### New Capabilities

- `actual-marketplace-held-refund`: Reconstruct evidenced marketplace sale releases, temporary holds and claim settlement without inventing spending.

### Modified Capabilities

None.

## Impact

Actual CLI adapter, its automated tests, operational documentation and a verified historical Mercado Pago account. No API bypass, direct database write, new expense or historical fee mutation.
