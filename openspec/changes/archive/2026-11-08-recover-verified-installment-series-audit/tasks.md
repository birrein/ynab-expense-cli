## 1. Verify recovery safety

- [x] 1.1 Add failing tests for exact pending recovery and for partial series, changed unrelated data, candidate or backup and read failure; verify no transaction updates occur.
- [x] 1.2 Implement the recovery path with lease, lock, saved backup comparison and independent read-back; make the tests pass.

## 2. Validate and operate

- [x] 2.1 Run the adapter and Go test suites, validate the spec, and document the recovery workflow.
- [x] 2.2 Recover the pending TerraBike audit only after reviewing plan and independent full-budget comparison; verify exact retry and unchanged balances.
- [x] 2.3 Update reconciliation notes and archive the completed OpenSpec change.
