## Why

Actual's overview truncates notes, hiding hashtags placed after descriptions and evidence. Existing notes need a safe, previewable way to move their authorized tags first without changing their financial identity or provenance.

## What Changes

- Add a dedicated notes-only operation that moves existing standalone hashtags to a leading line, retaining their spelling/order and all other content.
- Prefer leading hashtags for future transaction creation and explicit tag additions; reject duplicate/ambiguous tokens instead of silently removing evidence.
- Preserve current descriptive-replacement protections and the existing lease, lock, backup, sync, independent readback and ledger audit path.
- Document targeted execution, preview and recovery, including blocked malformed source links.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-transaction-notes`: prefix existing tags, add new tags first, and format future transaction notes with tags first while preserving evidence.

## Impact

Changes the Actual adapter's note formatter and amendment module, their Node tests, the runbook and this capability's spec. No dependencies, schema migrations, automation configuration or writes outside the CLP/USD allowlist. Financial execution remains a separate, verified post-archive operation; malformed provenance is reported rather than repaired by inference.
