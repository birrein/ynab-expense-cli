## Context

The existing dual-budget workflow already provides backups, pending audit and independent verification, but hard-codes a BCH reference. RappiCard statements report the CLP and USD legs in the same document.

## Goals / Non-Goals

**Goals:** Add a narrowly identified RappiCard variant without weakening the existing operation, reporting exclusions or replay protection.

**Non-Goals:** No exchange-rate inference, automatic statement parsing, account creation, changes to existing records, or new native cross-budget transfer semantics.

## Decisions

Accept `FX-RAPPICARD-STATEMENT-<date>` only when both named accounts are the known RappiCard CLP and USD accounts and each source begins with the RappiCard bank prefix. Keep the existing BCH path unchanged. This is safer than reusing a misleading BCH label or opening the operation to arbitrary free-form issuer references.

Reuse the existing snapshot, durable audit, backup, duplicate and verification pipeline. The operator reads the entire statement and verifies both exact amounts, timing and reporting filters before executing.

## Risks / Trade-offs

A pending second-leg failure can leave partial data; existing pending-audit guard requires inspection and blocks unrelated writes. Exact names constrain future renames; a renamed account needs an explicit reviewed update.
