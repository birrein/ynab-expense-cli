## Context
Verified bank statements provide distinct credit-line fees and taxes. Gmail source messages may contain multiple rows, so imported IDs must identify the line rather than the entire message.

## Goals / Non-Goals
**Goals:** authorize only explicit negative expenses, existing non-income categories, statement evidence and stable per-line identifiers, under the existing safe cashflow operation.
**Non-Goals:** treat credit-line draws or repayments as expenses, change opening balances or infer counterparties.

## Decisions
Extend the dedicated cashflow classifier and writer with an expense type. Reuse source matching, date/amount duplicate guard, leases, backup and full snapshot verification. No new writer.

## Risks / Trade-offs
Bank interest and tax can share dates or amounts: retain per-line identifiers and stop on possible duplicate matches rather than forcing an import.
