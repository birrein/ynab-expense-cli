## Context
A credit-line draw and its repayment are distinct bank rows but the duplicate detector catches nearby same-amount legacy entries. The bank statement identifies both rows and independent receipts identify the old entries.

## Goals / Non-Goals
Permit only a uniquely matched legacy income or reciprocal card transfer. Do not reinterpret the legacy payee, modify its dates, create a fabricated source or change any existing transaction.

## Decisions
Add `distinctLegacyLineMatch` with exact prior transaction, optional exact prior counterpart, earlier/different statement date, independently inspected receipt ID, statement ID, distinct row descriptors and explicit evidence. Restrict transfer to an active account whose name begins `Línea de Crédito`, enforce direction and signed amount; prior statement date differs from candidate by at most four days, prior snapshot date differs from its row by at most one day; the exact conflict set must contain precisely the supplied prior leg. Require a simple sourced historical income in the destination for a draw, or a reciprocal historical card payment from the origin for a repayment. The independent receipt is not attributed as a source for the new transfer. The operator must inspect all documents because IDs do not prove content.

## Risks / Trade-offs
Identical amounts alone are insufficient: exact historic snapshots, different dated bank rows, receipt and match coverage are compulsory. Partial writes retain existing source-based recovery and backups.
