## Context

The current operation retires an unowned historical total only if the recorded installments sum to it exactly. A lender can charge financing in addition to the cash price.

## Goals / Non-Goals

**Goals:** Retain the complete recorded series and permit an explicitly evidenced financing difference while preserving the existing audit and safeguards.

**Non-Goals:** Calculate interest per installment, modify installments or infer a purchase solely from a numerical match.

## Decisions

An optional positive integer `financeCost` in cents is accepted only when the sum of negative installment amounts equals the negative purchase amount minus that cost. A zero or mismatched cost fails closed. Existing candidates without this field retain exact-sum behavior. The purchase receipt and every statement must still be inspected by the operator; all transaction snapshots and statement dates, amounts, merchant, account and category remain exact.

## Risks / Trade-offs

Categories include finance charges already embedded in installments; the operation will neither redistribute nor invent their breakdown. Backups and audit preserve the retired total and candidate.
