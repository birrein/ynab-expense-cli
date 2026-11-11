## Why

A currency migration correctly stops near an equal-amount transaction, but two different merchants can have equal charges in the same card statement. Those independent statement rows can establish that both charges are distinct without weakening source deduplication.

## What Changes

- Permit only operator-identified exact nearby destination peers with separate verified statement rows, different merchants and unique bank references.
- Preserve the peer, original source, candidate hash, dual-budget backup, failure behavior and independent readback.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-statement-fx-expense-migration`: allow strictly evidenced distinct same-amount peers rather than rejecting every nearby amount match.

## Impact

Actual FX migration classifier, tests and runbook; no change to currency conversion or other operations.
