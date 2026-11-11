## Why

Two genuinely billed statement rows can have the same merchant, date and amount, making the normal duplicate detector unable to register both. A page boundary can also repeat a row visually, so counting alone is insufficient.

## What Changes

- Permit a second same-day, same-merchant row only when an independently inspected statement and its complete accounting totals corroborate two occurrences.
- Bind stable row ordinals to the prior verified ledger source and retain all existing safeguards and idempotent retries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-same-day-statement-expenses`: Support a narrowly verified two-row identical-descriptor exception.

## Impact

Actual cashflow adapter, tests and runbook; no blanket relaxation of duplicate controls.
