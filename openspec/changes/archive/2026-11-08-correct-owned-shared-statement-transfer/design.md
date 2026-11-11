## Context

Cashflow records can cite statement emails also used by other movements; their transfer receipts remain unique. Both account statements independently establish the same later posting date.

## Goals / Non-Goals

**Goals:** Preserve original sources and ledger while correcting both reciprocal dates; maintain safe retry and pending-audit handling.

**Non-Goals:** Change amounts, infer or create transactions, detach shared statements, or allow shared transfer receipts.

## Decisions

Add an explicit common-posting mode with the two original distinct statement-message IDs plus both independently reviewed Drive statements. Only these statement IDs may be shared; every other original receipt source remains unique. Accept original candidates and ledger records with absent or empty Drive lists. Hash the exact full candidate, ledger and budget; use one pending audit before both date updates and complete only after independent full readback. Original candidate retries verify through the exact complete audit without writing.

## Risks / Trade-offs

Shared messages do not prove file identity or dates by themselves; the operator must inspect both statements, their message provenance, receipt and collisions. If either update or readback fails, retain the backup and pending intent and block writes.
