## Purpose

Resolve an unsupported historical ride record only when an independently documented earlier ride and complete provider and bank evidence establish a narrow overlap.

## ADDED Requirements

### Requirement: Verify provider archive and bank-backed retained ride
The adapter SHALL require exact, distinct, simple historical transaction snapshots in the same active account, with matching payee, category and negative amount, the earlier retained record cleared and the later record not cleared or reconciled. It SHALL require a private provider export with a verified SHA-256, an identified completed earlier trip matching time, fare, currency and last four payment digits, and no provider trip within one day of the later record. It SHALL require two distinct statement IDs, a receipt ID and operator-reviewed evidence explaining matching route, card and the absence of another billed ride. The operator SHALL inspect full statements and sources; identifiers and numerical coincidences alone SHALL NOT establish absence or identity. Source ownership, other close duplicates, altered snapshots, invalid files and ambiguous rows SHALL block the operation.

#### Scenario: Earlier ride and later unsupported record
- **WHEN** the export and reviewed evidence establish the earlier completed trip and no trip for the disputed interval, both snapshots and bank evidence match and no conflict exists
- **THEN** preview SHALL show the retained transaction, disputed record, affected account and balance change with a digest binding evidence, ledger and complete budget.

#### Scenario: Conflicting source or distinct trip
- **WHEN** the export is changed, does not cover the interval, contains a disputed-period ride, has multiple retained matches, or any account, date, amount, evidence or ownership differs
- **THEN** the adapter SHALL fail without writing.

### Requirement: Audited recovery-safe retirement
The adapter SHALL require the exact preview digest and owned lease and lock, back up and revalidate, persist pending intent before deleting the disputed row, sync and independently verify all transactions, balances, rules, schedules and dashboards. Pending intent SHALL block all financial writes. Exact completed retry SHALL recheck the evidence and preserved record without writing.

#### Scenario: Interrupted operation
- **WHEN** a deletion, sync or independent check fails
- **THEN** pending audit and backup SHALL remain and unrelated writes and automatic retries SHALL be blocked.

#### Scenario: Successful readback
- **WHEN** the independent download confirms the original record absent and retained record and all unrelated data unchanged
- **THEN** the adapter SHALL mark the audit complete with both original snapshots and the evidence.
