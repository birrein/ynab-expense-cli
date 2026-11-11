## Context

The existing investment-opening operation is expressly restricted to a real fiat cash statement. A net redemption may instead establish a real receivable due from a settlement provider without evidence of fiat cash held before payment. It is not a complete investment ledger. The normal cashflow operation already creates verified native transfers between accounts.

## Goals / Non-Goals

**Goals:** Capture only a documented net receivable checkpoint and permit its independently evidenced bank settlement. Preserve strict native starting-balance and report semantics. Reuse the existing cashflow transfer after checkpoint verification.

**Non-Goals:** Do not infer the acquisition's value, bonus recognition, taxable profit, market value, past or present balance of crypto assets, or convert the old investment outflow. Do not present the checkpoint as a complete investment account or fiat cash balance.

## Decisions

- Use a distinct operation and audit family rather than loosening the existing cash-statement operation. The candidate supplies a unique descriptive account name containing the receivable concept, currency, checkpoint date, positive amount, stable source, independent vendor-document and bank-statement IDs, a confirmation email ID, reporting evidence and an explanation of limitations. The operator checks document contents and chronology; IDs are provenance, not proof.
- Create a native starting balance dated on or before the confirmed bank-credit date and name/annotate it a limited net receivable checkpoint, not a cash balance or income. Its income category must already be excluded from the specific reports in use; other reports remain a documented limitation. A cashflow transfer is a separate lease-protected operation.
- Reuse the existing, verified checkpoint creation lifecycle while keeping identity, note text and audit namespaces distinct; preserve an immutable pending audit before any API mutation and fail closed on interruption.
- Compare full budgets after independent reload and permit only the new account, payee and starting transaction. Retain prior facts and other budgets intact. No automatic reliance on a particular cryptocurrency, wallet, bank or amount.

## Risks / Trade-offs

- [Partial position accounting can conceal the cost or bonus] → Name the account as a receivable checkpoint, document that prior investment history and income are unresolved, and do not claim full portfolio or bank reconciliation.
- [Reports include Starting Balances] → Require documented verification of affected report filters before application; other reports remain explicitly unverified.
- [Partial create or transfer] → Preserve a pending audit and backup; recovery investigates before retry and never changes source IDs.
- [Repetition or false attribution] → Require distinct supporting documents, a stable unique source and operator verification of net amount and account ownership; reject account, audit or source collisions.
