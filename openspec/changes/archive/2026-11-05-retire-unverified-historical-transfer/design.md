## Context

The existing destination amendment protects historical transfer identities, lease, ledger, snapshots and balances. The standard expense removal explicitly rejects transfers. Statements independently verified by the operator can establish that an old pair is unsupported.

## Goals / Non-Goals

**Goals:** retire one exact, source-free historical pair with a reversible backup and durable audit, while verifying every unaffected record and balance.

**Non-Goals:** automatically interpret statements, merge transactions, adjust account opening balances, or delete source-linked or reconciled entries.

## Decisions

Use the existing Go CLI forwarding and the daily adapter's official Actual API, lease and lock. Candidate includes exact IDs, accounts, date, opposite amounts and two distinct Drive statement IDs plus an operator-provided evidence explanation; read-only preview revalidates snapshots. The operator must inspect each original statement before planning. Restrict both legs to null notes/import IDs and no ledger or schedule membership. An alternative direct database edit bypasses sync and safeguards and is excluded. An account adjustment would conceal the faulty pair and distort historical reporting.

Write a private backup and immutable candidate before calling the official deletion operation. Independently reconnect and verify both legs absent, all remaining transactions unchanged by ID, reference data unchanged, and both account balance differences exact. Persist the completed audit only after verification. If interrupted without audit, fail closed and use the backup for recovery rather than guessing.

## Risks / Trade-offs

- A statement's scope or absence could be misread → require manual verification of both full statements, date and accounts and preserve evidence links.
- API transfer deletion can affect both legs → verify its behavior against a disposable fixture before touching the production budget, and enforce the final whole-budget invariants.
- A failed write leaves uncertainty → preserve before snapshot and backup, report a blocking state without retry mutation.
