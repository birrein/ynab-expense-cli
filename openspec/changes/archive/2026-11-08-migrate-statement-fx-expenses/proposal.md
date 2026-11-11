## Why

An original-currency alert can be recorded in the CLP budget even when the card statement bills the purchase in USD. Recording the actual USD debt conversion then leaves the same expense in two economic places and distorts balances.

## What Changes

- Provide an explicit, statement-backed operation to replace a simple ledger-owned original-currency expense with the exact billed-currency expense across the two Actual budgets.
- Preserve source IDs, old transaction, notes and existing audit lineage; record immutable conversion evidence and the new transaction identity.
- Guard migrated sources against cross-budget replay and block all adapter mutations when migration is pending.
- Back up, revalidate, synchronize and independently verify both budgets; refuse ambiguous, stale or partially completed cases.

## Capabilities

### New Capabilities
- `actual-statement-fx-expense-migration`: Safely migrate a sourced card expense to its exact billed currency without duplicated consumption.

### Modified Capabilities

## Impact

Actual daily adapter, source ledger and financial operation tests; no new dependency, remote configuration or budget outside the existing allowlist.
