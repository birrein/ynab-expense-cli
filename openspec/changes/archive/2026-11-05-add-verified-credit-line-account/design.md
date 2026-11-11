## Context

Cashflow transfers require two existing on-budget accounts. A bank overdraft facility is a distinct debt product with a documented zero utilized balance at a known date.

## Goals / Non-Goals

**Goals:** create exactly one uniquely named account with zero opening balance and a transfer payee, using the existing budget and audit.

**Non-Goals:** infer current debt, register principal as income or spending, create a remote bank account or budget, or alter existing historical accounts.

## Decisions

Use the official Actual API through the existing lease and adapter, with statement ID, date of zero opening, product description and evidence in a private candidate and ledger. Preview rejects any account name collision unless exact completed audit identifies it. Backup and revalidation precede account creation. Independent readback must verify one account, one transfer payee, no transaction or change to existing accounts, balances, categories, rules, schedules, payees or transactions. A line modeled as a category would distort reports; a synthetic adjustment would mask the underlying liability.

## Risks / Trade-offs

- A missing audit after a partial write must fail closed and be investigated from backup.
- Operators must verify the bank statement and zero opening independently; the adapter does not parse evidence.
