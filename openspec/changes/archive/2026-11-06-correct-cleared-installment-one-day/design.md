## Context

`cleared` and `reconciled` are distinct flags in Actual. The adapter presently rejects both. Reconciled records remain out of scope.

## Goals / Non-Goals

**Goals:** Preserve `cleared:true` when a confirmed, unreconciled installment is only one day away from its evidenced billing cutoff, within the same month.

**Non-Goals:** Change cleared or reconciled flags, edit reconciled records, allow arbitrary date movements, or infer evidence from IDs.

## Decisions

Require `preserveCleared:true` and an original purchase Gmail receipt plus a verified billing statement, in addition to all existing neighbor and ledger checks. Limit the absolute date correction to one day within the same month. Supplying the flag for an uncleared record is rejected. Existing independent whole-snapshot comparison proves every field other than date, including cleared, remains unchanged. Alternatives allowing arbitrary cleared date changes or assuming a cleared record needs no audit are rejected.

## Risks / Trade-offs

The document IDs do not prove their contents: the operator independently checks the purchase, target statement, cutoff date, series and account. A cleared-but-unreconciled flag is preserved, but this does not constitute bank reconciliation.
