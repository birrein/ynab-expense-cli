## Context
The daily adapter is the only authorized Actual writer. The Go CLI wraps it; the official Node API handles budget sync. Bank statements are transaction evidence and do not create separate transactions. Native transfers must not be categorized as expenditure.

## Goals / Non-Goals
**Goals:** native paired own-account transfers and explicit-category income with stable source identity and full independent verification.
**Non-Goals:** infer account ownership, convert currency, fix unrelated transactions, bypass ambiguous duplicate checks or change bank accounts.

## Decisions
Use one dedicated operation with explicit transfer or income type and separate input validation. Preview against a fresh full snapshot. Require exact origin/destination evidence and payees; treat same amount within four days in either transfer account as review. For income require an existing income category. Before mutation use the existing backup and lease/lock. Create a native transfer using Actual's transfer payee with runTransfers enabled; independently verify two reciprocal IDs and both account balances. Income creates one positive transaction. Store source links in notes and private audit. A source retry only verifies an exact existing transaction or pair; partial conflicts stop for manual inspection.

## Risks / Trade-offs
Actual may generate transfer counterparts or rule changes differently: test in an isolated copied budget and stop on unexpected mutations. Date differences at month boundaries require explicit evidence; no guesswork or auto-force of near matches.
