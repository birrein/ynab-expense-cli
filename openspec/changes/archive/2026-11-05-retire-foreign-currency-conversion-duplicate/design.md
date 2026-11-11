## Context

The existing duplicate-expense operation only permits identical local amounts and a nonempty historical imported ID. The historical record here has no imported ID and its conversion differs from the bank entry.

## Goals / Non-Goals

**Goals:** Add a strictly constrained mode with exact identity, explicit original currency/amount, bank ledger and statement evidence, and existing transactional controls.

**Non-Goals:** Infer duplicates from a small local difference, modify a retained charge, broadly relax existing modes, or rely on statement IDs as a substitute for the operator reading documents.

## Decisions

- Extend the existing adapter with an exclusive `fxDuplicate` object carrying the exact old amount and original USD amount in minor units. Require CLP, same date, payee and category, recognizable USD amount in both notes, bank ledger ID and exact statement Drive link in both retained record and ledger.
- Permit null old imported ID only in this mode. Existing amount-match and partial-receipt modes retain their validations.
- Retire the original local amount and verify all other data and exact resulting balance. Preserve prior snapshot and candidate in backup and audit.
- Alternative of creating a generic deletion operation is rejected because it would not constrain foreign identity. Editing an amount before deleting is rejected because it mutates extra financial data.

## Risks / Trade-offs

- Similar subscriptions can have the same merchant, date and foreign amount. The operator must manually verify the complete statement and the specific historical record; local similarity or an ID alone is insufficient.
- Actual has no atomic compare-and-set; revalidation and independent readback detect concurrent changes but cannot fully prevent the race.
