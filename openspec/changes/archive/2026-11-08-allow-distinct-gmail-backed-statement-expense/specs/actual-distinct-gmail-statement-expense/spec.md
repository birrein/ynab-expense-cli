## Purpose

Allow a verified statement expense to coexist with one distinct, independently evidenced Gmail-backed expense of the same amount.

## ADDED Requirements

### Requirement: Safely distinguish two statement rows
The adapter SHALL permit a distinct expense only when the operator independently verifies two dated bank statement rows and their separate Gmail receipts, the sole nearby equal-amount conflict matches the complete prior transaction and verified Gmail ledger snapshots, and merchant, date, statement references and sources are distinct. It SHALL preserve the prior transaction and all its sources, reject other conflicts, and accept an explicit pending category.

#### Scenario: One distinct prior Gmail expense
- **WHEN** all stated prior snapshots, sources, merchant identities and inspected bank rows agree
- **THEN** the plan may propose one distinct new expense with backup, owning lease, revalidation and full independent readback.

#### Scenario: Missing, reused or changed evidence
- **WHEN** a source overlaps, the prior transaction or ledger changed, two rows cannot be distinguished, or another potential match exists
- **THEN** the candidate stays in review without a financial write.

#### Scenario: Retry after verification
- **WHEN** the exact completed source is repeated
- **THEN** the adapter verifies the existing expense without a second movement.
