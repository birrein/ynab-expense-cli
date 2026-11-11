## Why
The Go CLI only supports YNAB while Actual reconciliation uses a separate Node entry point. Confirmed installments remain missed because no verified operation posts and links their schedules.

## What Changes
- Expose existing Actual daily operations through the Go CLI using the pinned official Node client and preserving YNAB behavior.
- Add a guarded, idempotent operation to post a verified billed installment against its exact schedule and source, preserving schedules and other records.
- Document and test the workflow and reconcile supported October installments after archival.

## Capabilities

### New Capabilities
- `actual-cli-and-installment-posting`: Go CLI access to Actual operations and verified installment posting.

### Modified Capabilities

## Impact
Go CLI, existing Node Actual adapter, tests, runbook, private financial state and Actual CLP budget. No new writer, server configuration or dependency upgrade.
