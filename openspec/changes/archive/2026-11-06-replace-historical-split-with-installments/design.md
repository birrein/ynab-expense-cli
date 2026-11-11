## Context

The existing historical replacement handles only simple purchases. Split updates and split creation exist separately and can have asynchronous side effects; the new operation must not weaken either path or infer a document's content from an identifier.

## Goals / Non-Goals

**Goals:** Preserve each historical line and the full series, account balance and unrelated budget state, with auditable evidence and fail-closed recovery.

**Non-Goals:** Support cleared or reconciled targets, transfer/refund lines, partial/future series, automatic receipt fetching, altering category decisions, or automatic recovery from partial writes.

## Decisions

- Use a separate `historicalSplitInstallmentReplacement` operation and a complete snapshot of the parent and children. This avoids changing the already verified simple-purchase operation.
- Each installment carries bank date, number, amount, distinct statement and source, and a child-ID/amount allocation array. Validate all row and column totals and bound proportional rounding to one CLP peso or USD cent using integer arithmetic. The operator explicitly reviews allocations and confirms source documents.
- Update the existing parent and its original children into the first installment, then create subsequent split parents with new children. Preserve notes, categories and payees; append source evidence to parent notes only. Save the exact full candidate and pending audit before the first write.
- Before retry, require a completed candidate-identical audit and exact independent full-series snapshots. Pending or mismatched state never retries automatically. Independently verify complete budget and balance invariants before completing the audit.
- Test with failure injection and, before financial use, an isolated local API copy of a split budget where feasible; never mutate a remote test budget or use SQLite directly.

## Risks / Trade-offs

- [API split semantics or asynchronous updates differ] → Validate in a disposable local API copy and require full readback; stop on any mismatch and inspect backup.
- [Allocation implies item-specific billing not shown by bank] → Label allocation as proportional accounting distribution and preserve exact whole-purchase item amounts.
- [Concurrent remote edit] → Owned lock, pre-write sync/revalidation and full independent readback detect conflicts; do not claim atomic compare-and-set.
