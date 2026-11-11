## Context

The original operation requires a `#cuotas` note in addition to a receipt and a complete statement series. Some historical notes accurately describe products but lack that tag.

## Goals / Non-Goals

**Goals:** Support the same operation for an untagged historical total when a structured declaration binds independently inspected receipt evidence to that exact original and installment series.

**Non-Goals:** Authenticate documents automatically, manufacture transaction tags, override duplicates, or change any existing backup, verification, ledger or retry behavior.

## Decisions

- Add optional `receiptInstallmentEvidence` containing exact `transactionId`, `account`, `purchaseDate`, `amount`, `messageId`, `cardLast4`, and `installmentCount`. Require all keys and no extras; validate them against the original, receipt ID and complete series, and require exactly four card digits. Untagged originals require this object; tagged originals remain supported without it. Any supplied declaration must validate even if the original is tagged.
- Keep receipt and statement inspection an explicit operator responsibility: a structurally valid declaration alone is not proof. The existing purchase and statement links and full candidate are retained in the audit.
- Keep the note content unchanged apart from the existing generated installment details, with no invented tag. Reject missing text notes rather than silently replacing them.

## Risks / Trade-offs

- [Operator can misread evidence] → The runbook requires independently examining all documents, matching account/card, date, amount, merchant and series, plus review of the preview.
- [A remote change races with apply] → Retain the existing pre-write sync, pending audit, lock and independent full-budget readback; no new atomicity guarantee is claimed.
