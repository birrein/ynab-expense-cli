## 1. Evidence and representation

- [x] 1.1 Verify statement cutoff calculations, other unbilled operations, inferred rate and rounding against the source documents; record the exact evidence and remaining discrepancies in the vault.
- [x] 1.2 Verify the official API's transfer-split behavior in an isolated test budget and select a representation that preserves both linked principal and categorized interest without duplicate gross charges.

## 2. Implementation and verification

- [x] 2.1 Implement strict candidate and source validation, amortization arithmetic, duplicate and partial-write detection; exercise inconsistent and ambiguous scenarios with tests.
- [x] 2.2 Implement preview, account creation and journal writes with lease, lock, backup, sync, independent readback and durable audit; test success, retries, partial failure and preservation of unrelated data.
- [x] 2.3 Integrate the operation into the existing CLI/adapter and document usage and recovery; run the targeted tests and applicable regression suite.

## 3. Record evidenced history

- [x] 3.1 Prepare a private candidate and compare its preview to the contract, all seven statements, the inferred table and existing non-posting reminders.
- [x] 3.2 Apply only if all evidence and checks agree; independently verify card, loan, principal, interest, unrelated balances and reminders, and update the hub and monthly notes.
- [x] 3.3 Validate and sync the OpenSpec delta and archive the completed change without changing unrelated files.
