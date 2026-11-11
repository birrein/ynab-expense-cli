## Context
Existing single-installment correction enforces a preceding neighbor and identical normalized notes. Earlier transfers and installment notes must remain unchanged.

## Goals / Non-Goals
**Goals:** Allow first and penultimate cases only when separately evidenced and all neighboring snapshots match.
**Non-Goals:** Fuzzy-match arbitrary notes, correct reconciled targets, modify ledger-owned neighbors, or change an installment amount.

## Decisions
For number 1, accept `next` and `next2` with matching exact normalized series signatures and consecutive months. For a penultimate target, allow explicit `verifiedFinal` with an exact next snapshot and final statement ID, two previous exact normalized neighbors, a unique matching registered bank-statement ledger record, distinct source and statement, same account/payee/category and a distinctive common series label in target and final notes. Check numbered tags in each note, provenance link, date sequence, and full snapshots. The standard pending audit, backup and readback paths remain unchanged. Exact prior behavior remains unchanged for ordinary corrections.

## Risks / Trade-offs
- [False match from abbreviated note] → Require full snapshots, explicit distinctive label, ledger ownership and an independently inspected final statement; IDs alone do not verify content.
- [Unexpected overlap or altered prior] → Reject mismatched sources, neighbors, months, accounts, amounts, tags or duplicate targets.
