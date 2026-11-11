## Context

Completed mixed-payment audits preserve an exact card transaction snapshot and require it on retry. Some stored card notes now incorrectly describe their wallet components as pending.

## Goals / Non-Goals

**Goals:** Correct a uniquely selected descriptive fragment while preserving evidence and the original immutable group audit; make retries validate a separate precise amendment chain.

**Non-Goals:** Change categories, dates, amounts, payees, tags, links, source identifiers, account balances, ledger source evidence or the wallet component.

## Decisions

- Store a single separate amendment per receipt. Validate the entire original group and source ledger before planning; bind the candidate, complete budget, dashboard and stable ledger to the digest. Require a uniquely occurring old text outside protected metadata and forbid new links, hashtags or newlines.
- Persist a pending amendment before changing notes; block all financial mutations while pending. Verify a fresh download against an expected snapshot differing solely in target notes, then persist a completed audit containing the exact original, replacement, plan and backup.
- Original-group retries compute the expected card notes from a matching completed amendment only after revalidating its evidence and immutable candidate. No prior audit is modified; absent, pending or mismatched amendment remains an error.

## Risks / Trade-offs

- Existing clients could change data concurrently → revalidate after backup and compare full independent readback; Actual has no atomic compare-and-set.
- An interruption leaves unknown write state → retain durable intent and backup, stop other financial writes and investigate before recovery.

## Migration Plan

Test rejection, full write, retry, altered audit, interruption and isolated official API before live plans. Apply only exact independently verified results; close lease and archive.
