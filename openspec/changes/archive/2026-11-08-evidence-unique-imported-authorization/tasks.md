## 1. Evidence and implementation

- [x] 1.1 Add focused tests for the allowed legacy identity and rejection of changed provenance, ambiguous authorizations, duplicate settlement and payee mismatches; demonstrate the allowed case fails before implementation.
- [x] 1.2 Implement the constrained alternative and verify focused tests, existing receipt-number behavior and exact idempotent retry.
- [x] 1.3 Exercise backup, no-write rejection, amount-only change and independent readback through integration tests.

## 2. Verification and documentation

- [x] 2.1 Document the operator evidence obligations and verify strict OpenSpec validation.
- [x] 2.2 Run the focused and full Node tests and the Go suite.
- [x] 2.3 Sync the delta specification and archive this completed change.
