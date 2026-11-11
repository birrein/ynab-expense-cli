## 1. Safe split installment replacement

- [x] 1.1 Add failing tests for exact row and column allocation, proportional rounding, duplicate/ownership and interrupted writes; demonstrate failure before implementation.
- [x] 1.2 Implement classification and API operation with pending audit, backup and independent full readback; pass targeted tests.
- [x] 1.3 Exercise the operation against a private synthetic offline budget and verify split IDs, amounts, notes and balances without touching the server; document that offline readback uses the same process.
- [x] 1.4 Integrate adapter dispatch and document operator evidence and failure recovery; validate OpenSpec.

## 2. Full verification

- [x] 2.1 Run all adapter tests and Go tests; verify no regressions before archiving the change.
