## Context

The current operation requires identical payee IDs. Issuer names in migrated and bank-backed records can differ; the financial evidence and component ledger remain essential.

## Goals / Non-Goals

**Goals:** Support the single documented issuer name pair while keeping all preexisting safeguards and retries.

**Non-Goals:** General fuzzy payee matching, cross-account deduplication, or treating name equivalence as proof that transactions duplicate each other.

## Decisions

An explicit `historicalIssuerAlias` object contains the aggregate payee ID and exact expected names. Validate those names against the live snapshot and a fixed, oriented allowlist: historical `Falabella`, component `Banco Falabella`. Only historical unowned aggregates qualify, all components must use the same issuer and category as the historical aggregate, and all existing exact account/date/amount/source checks remain. The operator supplies and inspects the statement evidence separately. Same-payee requests remain unchanged.

## Risks / Trade-offs

An alias alone does not prove duplication: the statement, amount, dates, categories and independent evidence must all support it; ambiguous cases stay pending. A fixed mapping requires code changes for other banks but avoids broad guesses.
