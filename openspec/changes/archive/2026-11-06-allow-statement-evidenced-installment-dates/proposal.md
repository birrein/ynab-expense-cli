## Why

Some historical installment purchases have no merchant email but appear consistently in the first and later bank statements. Their billing dates remain wrong because the adapter requires a Gmail purchase identifier even when both statements are available and independently verified.

## What Changes

- Accept an original purchase bank statement as an alternative to the Gmail purchase message for a historical installment date correction.
- Require the original and target statement IDs to be distinct, an exact verified series and the existing safety and independent readback controls.
- Keep the email-evidence mode and all existing validation behavior intact.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-installment-date`: permit a verified original purchase statement as an alternative purchase evidence source.

## Impact

The Actual daily adapter, focused tests and operational runbook. Financial changes still require an independently reviewed candidate, plan and leased apply.
