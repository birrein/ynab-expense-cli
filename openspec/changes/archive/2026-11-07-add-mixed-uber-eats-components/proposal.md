## Why

An Uber Eats order is confirmed as paid with a card and Uber Cash, but the existing mixed-payment operation only accepts Uber rides in Transportation. The wallet portion remains missing.

## What Changes

- Accept the existing Uber Eats payee only with an existing Eating Out & Delivery category for a fully evidenced mixed order, preserving the card source and transaction.
- Retain the same plan digest, duplicate checks, backup, pending-intent protection, independent verification and partial-wallet limitations.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-partial-uber-cash-reconstruction`: Include evidenced mixed Uber Eats orders in the existing component operation.

## Impact

Actual adapter validation, tests, documentation and the user's partial wallet. No existing card rows or source records change.
