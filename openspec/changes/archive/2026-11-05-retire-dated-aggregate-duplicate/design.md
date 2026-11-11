## Context

The current deduplication requires matching component and bank posting dates exactly.

## Goals / Non-Goals

**Goals:** Preserve historical item categories while correcting an evidenced one-day posting difference.

**Non-Goals:** Infer itemization from amount alone or allow arbitrary date windows.

## Decisions

An explicit componentDateEvidence provides the common item date and Gmail receipt ID. Every component must have that date and the statement date must be exactly one day later; the operator inspects both sources. The existing ledger source is marked superseded and cannot be re-added.

## Risks / Trade-offs

Different purchases may have the same amount; mitigate with the complete itemized receipt and matching statement, not just the amount.
