## Why
An earlier audited correction assigned both transfer legs the operation date. Independently reviewed bank statements can later establish a different posting date for one leg; changing it must preserve the original audit and its repeat verification.

## What Changes
- Allow an explicit, exact chain from a completed historical transfer-date audit to a later statement-date correction of one leg.
- Verify that a repeat of the older audit accepts only the exact complete linked correction, while pending, inconsistent, and unrelated history remains blocked.
- Retain all existing snapshots, independent verification, lease, hash, backup, source, and collision protections.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `actual-historical-transfer-date`: preserve and verify a later independently evidenced correction of an already audited transfer.

## Impact
Actual daily adapter transfer-date and posting-date modules, tests, runbook, and audit records. No budget migration or dependency change.
