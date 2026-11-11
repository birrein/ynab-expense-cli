## Why

The cross-currency debt workflow currently requires a Banco de Chile reference even when another issuer's statement contains both exact legs. RappiCard debt converted from USD to CLP cannot be represented with truthful provenance under that restriction.

## What Changes

- Accept an explicitly identified RappiCard reference alongside the existing Banco de Chile reference.
- Require matching RappiCard account names and issuer-specific sources for the new path, with all existing evidence, duplicate, backup, pending-audit and independent verification controls preserved.
- Document and test correct reporting and rejection of incorrect issuer/account combinations.

## Capabilities

### New Capabilities

### Modified Capabilities

- `actual-evidenced-cross-currency-debt-transfer`: support a separately identified statement-backed RappiCard debt conversion.

## Impact

Actual adapter validation, focused tests, operation runbook and capability spec; existing transactions and provider configuration are unchanged.
