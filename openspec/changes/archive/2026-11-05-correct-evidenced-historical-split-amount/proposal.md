## Why

A historical split may contain a transcription error even when a statement and itemized order verify the correct net and specific category. The existing adapter cannot amend just that erroneous component without disturbing the other split lines.

## What Changes

- Preview and correct one specifically identified split component and its parent total using independently verified statement and merchant evidence.
- Preserve all other transaction fields and splits, with lease, backup, pre-write revalidation, independent readback and audited retry.

## Capabilities

### New Capabilities

- `actual-historical-split-amount`: correct one evidenced historical split component and parent amount safely.

### Modified Capabilities

## Impact

Actual adapter, historical split validation, tests and operational runbook.
