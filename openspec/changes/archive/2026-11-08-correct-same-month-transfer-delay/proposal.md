## Why
A confirmed card-to-wallet transfer is recorded two days after both the card statement and destination receipt date. The existing operation accepts only one day within a month, preventing faithful correction without another transaction.

## What Changes
- Support an explicitly evidenced same-month delay of two to four days when a card statement and destination receipt independently establish the transfer date and identity.
- Preserve strict conflict, backup, audit, independent readback and retry guarantees.

## Capabilities

### New Capabilities

### Modified Capabilities
- `actual-historical-transfer-date`: Permit a bounded same-month date correction with explicit corroborating receipt and origin statement evidence.

## Impact
The Actual adapter, its tests and runbook; no changes to budgets or remote settings are inherent to this extension.
