## Context

Existing aggregate retirement covers a ledger-owned aggregate with historical components, the reverse of this case.

## Goals / Non-Goals

**Goals:** Validate and preserve independently recorded statement components and audit the old aggregate.

**Non-Goals:** Merge or change categories, or retire ledger-owned entries through this variant.

## Decisions

An explicit historical mode requires exact old identity and every component's matching cashflow ledger source, plus exact sum, payee, account and date. Existing mode and source-blocking behavior remain unchanged.

## Risks / Trade-offs

Sum coincidence is not proof: the operator must inspect the complete statement and document why all lines represent the aggregate.
