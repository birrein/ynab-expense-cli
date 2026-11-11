# actual-verified-credit-line-account Specification

## Purpose
Safely represent an existing independently verified bank credit line as a separate account in an existing Actual budget.

## Requirements

### Requirement: Create an evidenced zero-opening credit-line account
The adapter SHALL only create a uniquely named active on-budget account with zero opening balance when the operator supplies independently verified bank statements showing the specific line and zero initial utilization. It SHALL require preview, active lease and lock, backup, no existing name collision, synchronization, independent readback, verification of the account and transfer payee, preservation of every preexisting transaction and balance, and durable audit.

#### Scenario: Verified creation
- **WHEN** a reviewed line has zero initial utilization and its unique name and statement identity pass validation
- **THEN** one on-budget account and its transfer payee are created, with zero opening balance and no transaction.

#### Scenario: Collision or unverified source
- **WHEN** the name already exists without the exact audit, the source or evidence is absent or malformed, or the candidate contains unrelated fields
- **THEN** the adapter rejects the operation without mutation.

#### Scenario: Retry and interrupted write
- **WHEN** the exact completed creation is retried
- **THEN** the adapter verifies the account by audited ID and does not write again; an account without matching audit requires manual recovery.
