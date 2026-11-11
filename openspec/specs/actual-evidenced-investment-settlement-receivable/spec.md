# actual-evidenced-investment-settlement-receivable Specification

## Purpose
Represent a documented, net investment-redemption receivable and its separately verified settlement without inventing a past fiat cash balance or counting the bank receipt as ordinary income.

## Requirements

### Requirement: Evidence-gated settlement checkpoint

The adapter SHALL preview a unique, explicitly named receivable account and a historical native starting-balance checkpoint for an exact positive net amount. The candidate SHALL identify a vendor settlement document, a distinct recipient bank statement, an associated confirmation email, a stable checkpoint source, explicit valuation limitations and reporting evidence. The operator MUST independently verify the same beneficiary, amount, currency, payment relationship, and dates in the source documents. The checkpoint SHALL be labeled a settlement receivable, not an existing fiat cash balance, investment history, cost basis, investment return, fee or promotion.

#### Scenario: Preview a supported receivable
- **WHEN** sources, net amount, account identity, dates, reporting filters and limitations are provided and independently checked
- **THEN** preview shows one dated native starting balance and explicitly warns that it is a partial checkpoint, not a historical return or complete asset valuation.

#### Scenario: Ambiguous or conflicting evidence
- **WHEN** account, source, amount, ownership, reporting treatment or date is missing or conflicts with an existing transaction, account or audit
- **THEN** no mutation occurs.

### Requirement: Protected creation and reconciliation

Apply SHALL require an owned lease and lock, a backup, pre-write revalidation and a durable pending audit. It SHALL sync and independently reload the budget, verify the native starting balance, account, transfer payee, source, unchanged unrelated data and balances, and only then mark the audit complete. A matching completed retry SHALL be read-only. A pending or conflicting audit SHALL stop and require investigation. A subsequent same-currency transfer to the bank SHALL use separately verified source and destination evidence; the bank credit SHALL NOT be added as income or duplicated.

#### Scenario: Successful checkpoint and settlement
- **WHEN** the exact checkpoint is applied and the operator separately verifies and applies its matching bank transfer
- **THEN** the receivable is reduced by the amount received and the bank contains one native transfer leg, with no manufactured income.

#### Scenario: Interrupted creation
- **WHEN** creation or verification fails after the pending audit is saved
- **THEN** the operation stops without an automatic re-creation or a changed source identity.
