## Context

The previous entry and bank-backed entry are historical without imported IDs or ledger ownership. The provider export lists trips across years; absence is useful only within its demonstrable date coverage, and the statements and receipt must be reviewed separately.

## Goals / Non-Goals

**Goals:** Safely retire the one unbilled historical record, preserve evidence and independently verify invariants.

**Non-Goals:** Prove every provider export is complete, infer account identity, alter a cleared entry, change Gmail labels, or bulk remove similar rides.

## Decisions

- A dedicated operation accepts complete old and retained snapshots, exact request timestamp, card last four, export path and hash, two Drive statements, a receipt and human-reviewed evidence. It validates the ZIP file directly in memory with Python's standard `zipfile` and `csv` libraries, without extracting private data or printing rows, verifying exact SHA-256, date coverage, exactly one completed earlier matching trip and no trip near the disputed date. An arbitrary statement ID is not proof of its contents.
- The operator examines both full statements, any grouped charges, provider receipt and matching trip details. Retained entry remains byte-for-byte unchanged, and the original account remains open.
- Require exact candidate/budget/stable-ledger digest, existing lease and lock, ZIP backup, revalidation, durable pending audit and official delete; reconnect and compare every transaction, dashboards and all other state. A failed intent prevents all further financial writes; exact completed retry is read-only.

## Risks / Trade-offs

- Provider exports may be incomplete even when dated across the interval → compare full bank statements and receipts, keep evidence and phrase conclusion accurately.
- Concurrent clients bypass local lock → revalidate before mutation and compare full independent state afterwards, leaving intent pending on mismatch.

## Migration Plan

Tests first, implement isolated operation and global guards; validate full suite, rehearse on private offline copy, review actual evidence and plan, apply under lease, verify, update notes, sync and archive specs. Investigate any failure before any retry.
