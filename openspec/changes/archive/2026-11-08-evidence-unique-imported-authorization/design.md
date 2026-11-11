## Context

The existing imported-authorization path checks an original note containing the final receipt number. Some older CLI imports instead retain a merchant description and structured provenance. The adapter cannot independently read the Gmail and Drive documents: the operator must inspect them and determine identity before planning.

## Goals / Non-Goals

**Goals:** Permit an alternative, explicit legacy-note identity for a unique evidenced authorization, without altering existing receipt-number behavior or any financial write/readback protocol.

**Non-Goals:** Do not admit other import namespaces, reconciled entries, splits, transfers, ledger-owned entries, unverified sources, ambiguous original authorizations, or already recorded settlements. Do not claim that a previously quoted service charge proves the final service charge.

## Decisions

Retain receiptNumber as a required independently inspected receipt identifier. If it is absent from the old note, allow an explicit `legacyMerchant` alternative only when the original note starts with that merchant followed by a semicolon, includes the fixed provenance markers `source=pedido/boleta/Banco de Chile` and `source=ynab-expense-cli`, and the imported payee and current payee equal a nontrivial leading portion of the merchant description. Require the old amount to be unique in the account and date and reject another simple transaction of the final amount in the same account within three days, excluding the target itself. Preserve the exact old note, import ID, source IDs and snapshot. Recheck all invariants at preview, after backup, and upon completed-audit verification.

The original receipt-number path remains unchanged. Simply removing the receipt-number check would allow weaker matching; retroactively changing the old note to satisfy it would manufacture historical evidence. Rejecting all such cases leaves a documented settled discrepancy unresolved.

## Risks / Trade-offs

- A note's provenance markers and source identifiers do not prove document contents. The operator must independently inspect the matching merchant, card, authorization, goods and statement, including refunds and competing charges.
- A blanket uniqueness condition could reject a legitimate case; rejection is safer than guessing and remains reviewable.
- Existing audits require exact transaction equality. Do not amend notes or dates as part of this correction.
