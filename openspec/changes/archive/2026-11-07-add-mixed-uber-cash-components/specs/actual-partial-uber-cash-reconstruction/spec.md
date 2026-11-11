## ADDED Requirements

### Requirement: Add an independently evidenced missing mixed-payment component
The adapter SHALL accept a clearly identified existing partial Uber Cash wallet, the exact already-registered card transaction and source ledger record, a shared receipt, statement evidence, the receipt total and missing wallet amount. The existing card and wallet amounts SHALL sum exactly to the receipt total. The operator SHALL independently inspect the complete receipt and statement, transaction and source history and possible duplicates before planning. The adapter SHALL reserve the shared receipt, preserve the card transaction and source ledger exactly, and create only the missing wallet expense. It SHALL use an owned lease and lock, full-budget and stable-ledger plan digest, backup, revalidation, durable pending audit, independent readback and complete unrelated-data and balance comparison. An interruption SHALL block other financial writes pending investigation. An exact completed retry SHALL verify read-only and tolerate later unrelated wallet entries.

#### Scenario: Existing card source is shared with wallet component
- **WHEN** the receipt and statement support a single mixed payment and its card part already exists once
- **THEN** only the wallet part SHALL be created, linked to the same receipt through a durable audit, without replacing the existing source or adding the receipt total.

#### Scenario: Ambiguous source or stale state
- **WHEN** the source, total, ledger, duplicate checks or budget differs from the reviewed plan
- **THEN** the adapter SHALL stop without writing.

#### Scenario: Interrupted write
- **WHEN** the operation fails after persisting its intent
- **THEN** the audit SHALL remain pending and financial writes SHALL be blocked until investigated.
