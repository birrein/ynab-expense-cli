# Uncategorized statement credit implementation plan

**Goal:** Record a verified bank credit whose purchase category is unknown, without inventing income, while retaining Review and enabling later resolution.

**Architecture:** Add a narrow statement-credit operation with exact source identity, durable pending audit and full independent readback; separately resolve only after evidence supports a category. Reuse the existing adapter runtime and private ledger, preserving other entry routes.

**Review focus:** uncategorized credit dashboard effects; settled versus provisional credit; existing net or grouped transactions; source collision across entry points; interruptions before durable verification; stale category resolution snapshots.

1. Rehearse an uncategorized positive credit in an isolated budget and record balance, budget and report behavior. Result: account balance changes; budget income and spent do not, but an AQL positive-amount income widget includes the uncategorized credit even with an unrelated category exclusion. Stop live use until an exact-source widget exclusion is implemented and verified.
2. Write focused failing tests covering valid preview, evidence, sign, source collisions, duplicates, pending audit, exact retry and full readback. Implement the statement-credit path and reserve its source against other financial paths; run focused tests.
3. Write failing resolution tests and implement a separate exact-snapshot, evidence-backed category resolution preserving ID, source and balance; test concurrent change and retry. Add exact-source exclusion to affected income widgets under the same audit, with whole-dashboard revalidation and independent readback.
4. Run the relevant Node and Go regressions, inspect changes, validate OpenSpec, update the runbook, archive the change and only then preview the independently confirmed credit.
5. Apply only when backup, isolated report checks, duplicate review and plan agree; verify independently and update the monthly note and hub without advancing daily windows.
