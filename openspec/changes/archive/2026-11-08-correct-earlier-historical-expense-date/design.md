## Context

The existing expense-date correction handles forward corrections and independently verifies a date-only write. Income has a separate earlier-date mode. Cheque receipts may establish a posting before a manually entered historical date.

## Goals / Non-Goals

**Goals:** Allow an explicit earlier expense posting with a complete covering statement and independently reviewed receipt, retaining all existing safeguards.

**Non-Goals:** No unverified date inference, no financial account or amount changes, no automated identity inference, and no changes to existing modes.

## Decisions

Use an explicit `earlierExpensePostingEvidence: true` flag, rather than silently extending existing modes. Require an eligible categorized expense, an earlier date by one to four days, receipt date exactly equal to the new date, and a complete statement covering all dates. Existing collision and source ownership checks, full-state hash, lease, backup, pending audit and independent readback are reused. The operator verifies the receipt, account, amount and recipient using independent evidence.

## Risks / Trade-offs

- A bank cheque notice may omit the beneficiary → the operator must independently verify the cheque identity and payee; the adapter cannot interpret source content.
- A date-only edit changes historical daily balances → preview shows each affected day and readback compares the complete budget.
