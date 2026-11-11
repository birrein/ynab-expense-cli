## Why

Some historical income entries have a manually entered date after the actual bank posting. The current correction mode only permits a later date even when a complete statement and an independent receipt identify an earlier posting.

## What Changes

- Add an explicitly bounded earlier-posting alternative to the audited historical-income correction.
- Preserve the transaction, category, source ownership, full-budget verification and pending-audit safeguards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-income-statement-date`: support a separately evidenced earlier bank posting.

## Impact

Actual daily adapter, regression tests, operational runbook and the existing historical-income specification. No new dependency or transaction.
