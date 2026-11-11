## 1. Evidence and safeguards

- [x] 1.1 Write focused tests for valid imported correction, rejected ambiguity, source/amount bounds, ledger ownership and identifier preservation; confirm the valid test fails before implementation.
- [x] 1.2 Implement the exclusive imported evidence mode and pass the focused tests, retaining protections for other evidence modes.
- [x] 1.3 Test backup-before-write, exact readback, concurrency failure and read-only retry with the imported ID unchanged.

## 2. Verification and documentation

- [x] 2.1 Update the runbook and verify the behavior matches the evidence contract.
- [x] 2.2 Run focused and applicable full Node and Go checks, plus strict OpenSpec validation.
- [x] 2.3 Sync the delta specification and archive the completed change.
