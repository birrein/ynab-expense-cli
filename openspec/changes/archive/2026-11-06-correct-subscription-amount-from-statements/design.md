## Context
The existing classifier corrects an exact historical snapshot and audits all subsequent changes. The target subscription has no individual receipt, while two card statements and a service notice identify its recurrence.

## Goals / Non-Goals
Permit bounded evidence-backed corrections of a copied previous-month subscription amount. Do not fabricate receipt claims, create or remove movements, change category or infer external FX.

## Decisions
Add exclusive `subscriptionEvidence` containing `previousStatementId`, `noticeId`, and full `previous` snapshot. Require CLP integer pesos; correction at most CLP 100 and 5% of old amount; prior amount equals target old amount; same day in consecutive months, identical notes, account, payee and category; distinct valid statements and exact prior snapshot in current budget. Operator must independently read both statements and the notice and validate identities and bank amount. Existing receipt and installment modes stay unchanged.

## Risks / Trade-offs
Statement identifiers and notice are not content authentication: the operator independently inspects them. Similar recurring services might coincide; exact identity and prior snapshot plus strict bounds narrow but do not eliminate that risk. Existing backup, lease, revalidation and full readback continue.
