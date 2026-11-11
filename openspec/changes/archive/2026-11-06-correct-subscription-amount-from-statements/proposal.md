## Why
Historical subscription amounts copied from the previous month can differ from the card's settled charge, even when the subscription and its billing day are verified. A non-receipt service notice must not be misrepresented as a purchase receipt.

## What Changes
- Add a strictly bounded mode for correcting a simple subscription expense using two independently inspected consecutive card statements, an exact previous transaction and a service notice.
- Preserve all existing lease, backup, verification, audit and retry controls.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `actual-historical-expense-amount`: permit separately identified recurring subscription evidence without treating the notice as a receipt.

## Impact
Historical amount correction classifier, tests, runbook and archived OpenSpec. No new dependency or direct database write.
