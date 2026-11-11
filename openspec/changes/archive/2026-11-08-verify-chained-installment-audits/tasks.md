## 1. Safety and implementation

- [x] 1.1 Add failing tests for exact later target and neighbor audit chains in both retry paths, and prove pending or unrelated changes fail closed.
- [x] 1.2 Implement a bounded chronological lineage verifier and integrate it only into completed installment retries; pass focused tests.
- [x] 1.3 Verify new writes still reject stale neighbors, all unaudited changes and altered audit candidates.

## 2. Validation and documentation

- [x] 2.1 Verify existing real audit candidates against a fresh independently downloaded snapshot without writes; document any unsupported exceptions.
- [x] 2.2 Update the runbook and run focused and full Node tests, Go tests and strict OpenSpec validation.
- [x] 2.3 Sync and archive the completed change.
