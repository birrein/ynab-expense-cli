## Why

The existing Actual note correction deliberately prohibits modifying hashtags. Confirmed travel expenses need an explicit, auditable way to append a trip tag without opening arbitrary metadata editing.

## What Changes

- Add a dedicated `transactionTagAmendment` candidate for one validated tag, retaining exact existing notes.
- Detect existing tags, avoid duplicate insertion and reject pre-existing duplicate occurrences.
- Reuse exact identity/provenance checks, lease/lock, backup, synchronization, independent readback and append-only ledger audit.
- Test the new operation before tagging the three explicitly authorized travel expenses; document results in the Google Drive vault.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-transaction-notes`: Add explicit append-only tag amendments and duplicate handling while preserving the descriptive replacement restrictions.

## Impact

Actual notes module, adapter dispatch, isolated tests, runbook and the existing notes specification. No dependency, configuration, Gmail label or unrelated financial changes. Financial candidates and backups stay outside Git. The ongoing reconciliation lease must close before a new writer starts.
