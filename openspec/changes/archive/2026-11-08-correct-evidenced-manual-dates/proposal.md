## Why

Some manually entered historical movements predate both the actual receipt and the bank statement by nearly a week. Existing posting-delay modes assume the old date came from the receipt and cannot safely correct them.

## What Changes

- Add an explicit, separately evidenced bounded correction for a historical transfer and a historical categorized expense whose actual receipt and bank postings agree.
- Preserve existing date modes, full snapshots, ownership checks, backup, durable audit and independent readback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-transfer-date`: allow independently proved correction of a manually entered transfer date.
- `actual-historical-expense-statement-date`: allow independently proved correction of a manually entered expense date.

## Impact

Actual adapter, existing specifications, tests and runbook. No new transactions or dependencies.
