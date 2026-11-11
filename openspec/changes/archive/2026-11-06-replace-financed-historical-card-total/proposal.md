## Why

Historical card purchases sometimes record only the purchase price while statements bill a higher financed total over installments. Keeping the original obscures billing dates and undercounts the confirmed cost; adding installments would duplicate the purchase.

## What Changes

- Permit a narrowly evidenced financed replacement of one historical simple purchase by a full already-billed installment series, with a separately declared financing difference and purchase receipt on Drive.
- Preserve existing unfinanced and Gmail-evidenced behavior, original identity, audit, duplicate checks and fail-closed recovery.
- Verify the exact resulting card balance change and all unrelated data independently.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-historical-card-total-replacement`: support a fully evidenced billed total greater than the recorded purchase and a Drive receipt declaration.

## Impact

Actual adapter replacement module and tests, operational runbook, local private evidence and audits. No direct database writes or new financial accounts.
