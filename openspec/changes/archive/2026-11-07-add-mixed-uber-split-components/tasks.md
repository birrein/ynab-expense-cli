## 1. Safety and allocation

- [x] 1.1 Test and implement exact source, split and ledger validation with whole-order largest-remainder residual allocation.
- [x] 1.2 Test and implement digest, durable intent, backup, independent split readback, exact retries and pending-write guards.
- [x] 1.3 Test actual official API behavior in an isolated budget; pass Node, Go and strict OpenSpec checks; document operation.

## 2. Evidence and application

- [x] 2.1 Review receipt and statement, source snapshots and potential duplicates; inspect exact live plan.
- [x] 2.2 Apply with owned lease, verify original and new splits independently, and document treatment and remaining review.
- [x] 2.3 Close lease without advancing windows and archive completed change.
