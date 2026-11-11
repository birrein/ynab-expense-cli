## Context

The general cashflow writer only supports income categories for positive inflows; the regular refund operation supports one categorized purchase and cannot represent a combined bank transfer exceeding a single purchase.

## Goals / Non-Goals

**Goals:** Offset confirmed purchases and the full incoming bank amount in an existing loan category while exposing any unexplained difference.

**Non-Goals:** Guessing the reason for the excess, changing a bank amount, or merging purchase identities.

## Decisions

- Require complete prior transaction and ledger snapshots, source links, sender and bank evidence, a distinct stable bank source, exact deposit amount, category, and explanatory notes. Categorize each existing simple expense and remove only its stale pending note through explicit safe replacement.
- Create one positive same-category deposit with its bank source, link purchase IDs in the notes, and update each original source record and the reimbursement audit only after a full independent readback verifies unrelated data and account balances.
- Persist a pending audit with backup before any writes; a partial operation stops instead of silently retrying. A verified repeat must match audit, original transactions and deposit.

## Risks / Trade-offs

- Multiple operations are not atomic → preserve backup and pending audit, reject recovery without investigation.
- Excess is economically ambiguous → show it as an explicit unresolved difference, not regular income or a fabricated fee.
