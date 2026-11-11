## Why

Some evidenced historical split transactions remain uncleared even though bank statements show their posting date. The existing correction rejects them, preventing accurate daily balances without changing their status.

## What Changes

- Allow an explicitly preserved uncleared split and its uncleared children through the existing date-only correction.
- Keep all existing evidence, identity, duplicate, backup and independent verification protections.

## Capabilities

### Modified Capabilities

- `actual-historical-split-date`: allow fully uncleared parent and children while preserving their original status.

## Impact

Actual date correction validation, tests, and operational guidance. No financial account or amount is changed by the capability itself.
