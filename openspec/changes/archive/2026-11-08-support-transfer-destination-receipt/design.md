## Context

The existing one-leg correction requires two statement identifiers even if the destination bank issues a standalone confirmation. An invented statement ID must never stand in for a receipt.

## Goals / Non-Goals

Permit a distinct, independently reviewed destination-provider receipt to prove the unchanged destination date. Keep the source bank receipt and source statement. Do not authorize two-leg changes, payments, new transfers or any change to the normal two-statement mode.

## Decisions

Replace `destinationStatementId` with `destinationReceiptEvidence:{receiptId,date}` only in this explicit mode. Require the destination receipt ID to differ from the source receipt and its date to equal the unchanged destination leg; permit only the origin date to change by at most four days. Both receipts must be unowned and absent from other transactions and audits. The operator inspects both receipts and the complete origin statement for account, amount, identity and competing payments. Existing full snapshots, preview hash, lease, durable intent, backup and full independent readback remain mandatory.

## Risks / Trade-offs

A receipt may not prove a final settlement date in every provider: the operator must verify its semantics, not merely supply its identifier. A pending audit blocks later financial mutations until investigated.
