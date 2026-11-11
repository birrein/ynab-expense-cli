## Why
Bank statements downloaded from the bank can establish cash flows, but the current adapter requires a Gmail message even when the only authoritative source is an independently verified statement in Drive.

## What Changes
- Allow verified Google Drive PDF source references in cashflow candidates while retaining existing Gmail-only candidates and stable bank source IDs.
- Preserve exact evidence links in notes and audit; reject malformed or missing references and retain duplicate, backup, lock, synchronization, and independent verification safeguards.
- No account merger, balance adjustment, automatic extraction, or change to transaction classification.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-confirmed-cashflows`: Accept an independently verified bank statement stored in Drive as a source.

## Impact
Changes the Actual daily cashflow adapter, its tests and runbook. No change to budget identifiers, source IDs of existing transactions, or other accounts.
