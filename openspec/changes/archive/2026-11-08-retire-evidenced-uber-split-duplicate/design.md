## Context
The existing twin split operation requires equal amounts and unowned retained rows. It cannot represent a merchant-finalized order already registered with a receipt source.

## Goals / Non-Goals
**Goals:** Narrowly retire an unowned split when a unique provider order and distinctive child note and pre-discount amount agree, and preserve its bank-verified successor and all unrelated state.
**Non-Goals:** Generic fuzzy deduplication, moving ledger sources, mutating retained splits or inferring bank settlement from the export alone.

## Decisions
Use exact snapshots and a provider ZIP digest; inspect the Eats CSV via Python standard library and require the matching order to be completed, same date and total, unique within the day for the merchant and with exact distinctive item, quantity and raw price. Require historical child category, note token and amount to match the item, plus verified retained ledger record and receipt link. Operator separately reviews the statement and receipt. Bind preview to the candidate, live budget and ledger with a digest. Back up and record durable pending intent under lease before deleting, then reopen the budget and compare all state including dashboards; a completed audit makes an identical retry read-only. Refuse pending audits globally. The narrow match is preferred over weakening the existing generic twin-split guards.

## Risks / Trade-offs
- Provider data may not include every order or bank settlement; require complete bank statement and independent receipt review, and avoid claiming the export proves settlement.
- A failed write can leave partial state; a durable pending audit blocks additional writes pending investigation.
