## Context

The mixed-payment writer already handles verified Uber card rides and protects shared sources. The existing Uber Eats transaction has a different payee and dining category, so its wallet portion fails that narrow validation.

## Goals / Non-Goals

**Goals:** Allow only an exact Uber Eats and Eating Out & Delivery pairing, keeping all existing controls.

**Non-Goals:** Infer item details, rewards, wallet opening balance or arbitrary payee/category combinations.

## Decisions

- Extend only the payee/category predicate with the exact additional supported pair; preserve the wallet amount and category from the existing card row. Reusing the same writer retains the already tested lease, backup, intent and readback semantics.
- Verify receipt and bank statement separately before a live plan; a test fixture alone is not financial evidence.

## Risks / Trade-offs

- A broad merchant match could classify unrelated purchases → exact names and paired categories, negative tests and source/statement validation.

## Migration Plan

Add regression tests first, implement, run Node/Go and spec checks, rehearse using isolated official API and live preview, apply the exact reviewed plan, document, close the lease and archive.
