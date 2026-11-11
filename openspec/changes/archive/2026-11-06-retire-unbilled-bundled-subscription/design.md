## Context

Existing duplicate retirement requires the retained purchase to have a matching amount or a source-ledger identity. Legacy bundle and standalone records have different amounts, categories, notes and no imported source. A `cleared` flag in the old budget does not itself prove a bank charge; reconciled transactions remain ineligible.

## Goals / Non-Goals

**Goals:** Retire one exact unbilled legacy expectation only after the operator verifies the relevant statements, provider purchase history and receipt of the retained bundle; preserve all other transactions and audit the original.

**Non-Goals:** Infer nonpayment solely from a missing statement row, alter the retained bundle, general-purpose transaction deletion or change schedules, subscriptions, accounts, or bank data.

## Decisions

- A separate candidate identifies exact full snapshots of both records, two consecutive statement IDs, the provider receipt, order identity and a detailed human-reviewed evidence description. Each item is processed independently. The bank statement is not mechanically verified by supplying an ID; the operator must inspect the original documents and complete provider history.
- Both records must be simple, same account and merchant, close in date, contain the requested bundle and included-service labels, and have no split, transfer, schedule or reconciliation. The historical record has no imported ID or ledger ownership. Its `cleared` value is captured exactly and preserved in audit; a cleared item can be retired only if external sources independently disprove its charge.
- With lease and lock, snapshot and back up before persisting an intent. Revalidate before a single delete. Sync, download through a fresh client and verify the retained transaction, all unrelated records and exact account delta. An unresolved intent blocks all retries. An identical completed audit verifies read-only.

## Risks / Trade-offs

- [An unrecognized second provider account or delayed card charge] → Check full provider history and consecutive card statements; do not act when identity or absence is uncertain.
- [Incomplete delete] → Durable intent and backup make the state visible; fail closed until investigated.
- [Concurrent remote update] → Revalidate the full snapshot and verify independently after the write; Actual cannot provide atomic compare-and-set.
