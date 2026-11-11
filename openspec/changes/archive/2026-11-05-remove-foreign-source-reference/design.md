## Context

Candidate deduplication deliberately recognizes Gmail links anywhere in notes; existing note amendment operations protect provenance and cannot remove a foreign inline reference.

## Goals / Non-Goals

**Goals:** Remove one precisely identified foreign link in a source-owned target, preserving its own sources and the linked owner's transaction.

**Non-Goals:** Removing actual owned sources, changing ledger identity or relaxing duplicate detection.

## Decisions

- Require exact full target and owner snapshots, own ledger record, owner ledger record, foreign source ID and a strictly specified substring containing only the foreign URL and fixed surrounding text. Ensure each source has the expected ledger owner and exactly one foreign link in target, then remove that substring only.
- Backup and record the full candidate before API update; any changed live state without matching verified audit stops rather than retries. Verify every transaction and balance by independent download, then persist audit.

## Risks / Trade-offs

- A descriptive link could also be genuine evidence → require distinct transaction ownership and retain the foreign link in its rightful owner and monthly documentation.
