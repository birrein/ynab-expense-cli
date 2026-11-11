## Context

The current shared `verifyPosted` checks original rows and also asserts the account's current balance equals the initial group's net delta. That latter assertion is valid at the initial independent write verification, but not after additional verified wallet activity.

## Goals / Non-Goals

**Goals:** Preserve original audit verification while allowing legitimate later wallet transactions.

**Non-Goals:** Modify financial data, loosen initial full-budget readback or relax checks of original rows and shared card source.

## Decisions

- Keep account-balance checks in the initial `verifyUnrelated` path, and remove the lifetime-balance assumption from the shared original-row verifier used by completed retries. Alternative of accepting an unexplained balance delta in the original write would weaken the original guarantee.
- Test a completed retry after a later transaction, as well as rejection when an original record or linked ledger changes; verify real completed audit remains read-only.

## Risks / Trade-offs

- A retry no longer serves as a statement reconciliation for the wallet → document that it verifies original entries only; a full reconciliation must inspect all later entries separately.
