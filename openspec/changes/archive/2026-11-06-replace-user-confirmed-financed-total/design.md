## Context

The financed operation currently binds a Drive receipt to an exact original and complete statements. A specific direct user confirmation can identify a purchase where no merchant receipt was found.

## Goals / Non-Goals

**Goals:** Bind the exact user-confirmed transaction and bank series to a durable request reference and preserve all existing write safeguards.

**Non-Goals:** Treat a generic authorization, a merchant name, or matching amounts alone as confirmation; permit unbilled future installments; relax duplicate checks.

## Decisions

An alternative `userConfirmedFinancing` declaration is mutually exclusive with other purchase evidence modes. It requires a `call_` confirmation reference and confirmation date, exact transaction ID, account, date, amount, card suffix, installment count and finance cost. The operator must inspect the user's actual affirmative response and each statement; the reference alone is not proof. Notes identify confirmation and statement source; audit keeps the entire declaration and historical transaction. First installment retains the old ID. No fictional tag or receipt is created.

## Risks / Trade-offs

User recollection can be imperfect; require exact, specific confirmation and consistent independent statements. This is not a fallback for unavailable evidence of the billed amounts or account.
