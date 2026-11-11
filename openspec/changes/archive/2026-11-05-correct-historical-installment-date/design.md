## Context

The adapter handles historical category and transfer corrections but does not offer a statement-backed date-only correction. The API updates a date asynchronously; an offline experiment confirms that polling observes the date change while preserving other fields.

## Goals / Non-Goals

**Goals:** Move one evidenced installment to its billed month and preserve auditability and its source series.

**Non-Goals:** Change the amount, payee, category, notes, other installments or schedules; infer purchases from statement text alone; or declare an account reconciled.

## Decisions

- Require exact snapshots of the target and immediately adjacent numbered installments, a distinct original purchase message ID and statement ID, and an evidence explanation. Reject source-ledger transactions, transfers, splits, cleared/reconciled or scheduled transactions, and competing target-date entries for the same installment.
- Require neighboring notes to identify consecutive installment numbers and preserve a common series description; verify the new billing date lies in the expected middle month.
- Before modifying use the existing lease, lock, backup and snapshot revalidation. Poll the official API for the asynchronous change, sync, and independently compare the whole budget with only the date changed. A missing completed audit after a changed date is a stop for manual investigation.

## Risks / Trade-offs

- [An exact-looking nearby expense could be unrelated] → Require original purchase, statement and immediate peer identity; the operator must read sources, not infer from IDs alone.
- [A write can succeed before the process fails] → Do not recreate or retry a changed transaction without a matching verified audit and backup.
