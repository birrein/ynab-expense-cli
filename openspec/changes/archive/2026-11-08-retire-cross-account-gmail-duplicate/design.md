## Context

Gmail and bank `cashflows` are maintained in different ledger sections. The generic delete removes Gmail records and does not protect the source against later import; changing account or deleting the bank entry would lose the independently verified bank identity.

## Goals / Non-Goals

**Goals:** Preserve the bank cashflow unchanged, retire exactly one simple wrong-account Gmail transaction, retain all old records and prevent future source reuse, with independently verified whole-budget invariants.

**Non-Goals:** Infer document identity from IDs alone, general-purpose deletion, modify Gmail labels, transform splits or transfers, or reconcile accounts.

## Decisions

Use a narrow candidate with exact old and retained transactions, all old source records, the retained cashflow record, explicit Gmail IDs and bank statement ID. The operator reads all sources independently. Reject reconciled, cleared, scheduled, split or transferred expenses, additional matches, any source or snapshot mismatch, non-identical amount or category, and dates outside seven days. Preserve the bank record and all old Gmail records as reserved provenance rather than forge a Gmail import onto a bank-imported transaction. A durable audit maps these source IDs to the retained cashflow and prevents future mutation by source. This is safer than reassigning Gmail records to a transaction with an incompatible imported ID.

Use backup, revalidation and pending intent before delete; verify the entire independent budget, exact source-account balance delta and unchanged retained cashflow, then mark audit complete. Pending intents block writes. A completed exact retry is read-only. Do not silently recover a partially completed mutation or modify the source IDs.

## Risks / Trade-offs

- Bank and receipt correspondence remains a human evidence decision; candidate text is not proof. Retain source documents and audit.
- A crash after deletion but before verification creates a pending intent; block all financial changes and investigate the backup rather than retry deletion.
- Source guard must cover both ordinary Gmail creation and cashflow operations, and not be bypassed by alias or alternative command paths.
