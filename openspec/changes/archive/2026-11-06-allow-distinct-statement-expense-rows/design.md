## Context

The cashflow adapter checks all equal-value matches within four days; some are genuine repeated travel charges. A human must inspect the statement; a Drive identifier alone cannot establish its contents.

## Goals / Non-Goals

**Goals:** Permit the case only when the operator supplies the exact current snapshot of each competing simple expense and states the separate statement row for each, including distinct dates, shared statement and same account and amount.

**Non-Goals:** Automatically interpret PDFs, permit same-date ambiguity, waive missing matches or evidence, modify prior transactions, or change ordinary duplicate handling.

## Decisions

Use a distinctStatementRows candidate naming a shared Drive statement and every competing full transaction snapshot. Require the exact same payee ID as the candidate's uniquely resolved payee, category, account, amount, distinct valid dates, no parent/child/transfer, and exact snapshot equality. Match set must be exhaustive and every referenced row must have a different date from the candidate. Revalidate before writing and on independent readback; exact retries stay idempotent. The operator verifies the account, date, amounts, descriptor and all rows in the referenced statement. Alternatives: broad free-text override loses guarantees; separate merchant receipts do not exist in this case.

## Risks / Trade-offs

An operator could supply an inaccurate statement transcription; the CLI cannot independently read or validate the PDF. Mitigate through documented independent source verification and exact date, payee, row count, snapshot and live duplicate checks. Same-date rows and prior rows not matching the candidate's payee/category stay in review.
