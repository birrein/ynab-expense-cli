## Context

Cashflows own both reciprocal legs and an original immutable source record. The legacy posting-date correction excludes them, and the original cashflow classifier expects a common date and can rewrite existing ledger metadata. A correction must not erase this provenance.

## Goals / Non-Goals

**Goals:** Correct one exact owned transfer leg using corroborated account statements; keep existing source identities and make original retries non-writing.

**Non-Goals:** Create transfers, change amounts or categories, infer undocumented dates, migrate accounts, or change reconciled movements.

## Decisions

- Use a dedicated candidate and audit linked to the complete original ledger record and both exact transaction snapshots. The legacy record is retained byte-for-byte, including absent optional status fields. Legacy records must have an existing backup and verified timestamp. A generic ownership override would weaken other operations.
- Require active distinct accounts, reciprocal payees and links, one uniquely owned origin source, existing Gmail receipt and destination statement, an additional distinct origin statement, independently checked facts and all colliding transactions. The new origin date is one to four days later; the destination remains on the receipt date.
- Bind candidate, complete budget, dashboard and stable ledger to the plan hash. Back up, sync, revalidate, persist pending audit, update the one date, sync and compare an independent complete snapshot and dashboards before completing the audit. Globally block financial mutations on pending audit.
- The original exact cashflow candidate can be recognized as existing only through one complete matching correction audit and exact current pair; its retry must not rewrite the prior ledger. Unrelated candidates do not inherit the exception.

## Risks / Trade-offs

- A concurrent external Actual client is not covered by the adapter lease → revalidate immediately before writing and detect divergence on complete independent readback.
- The prior ledger contains historical date, whereas live posting differs → retain the old record and link the complete verified audit; consumers unable to interpret the audit continue to reject rather than infer.
- Partial API success after intent → leave pending and backup intact for investigation; never automatically retry the mutation or change sources.
