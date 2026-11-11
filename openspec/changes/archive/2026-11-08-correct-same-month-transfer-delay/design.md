## Context
The existing date correction is audited and changes only an existing reciprocal pair. A card statement and a wallet provider's successful-load receipt can prove both ends even when no wallet statement is available.

## Goals / Non-Goals
Permit a narrowly bounded same-month correction without creating transactions. Do not infer identity from two IDs, bypass duplicate checks or alter other transfer workflows.

## Decisions
Use an explicit `sameMonthEvidence` object with receipt and origin statement dates. Both must equal the proposed date; the historical date must be two to four days later in the same month. The receipt and statement IDs remain separate existing fields. Do not combine evidence modes. The operator must inspect actual documents, account identities and competitors; programmatic checks cannot interpret them. Preserve existing audit/recovery behavior.

## Risks / Trade-offs
- A valid identifier is not proof of its contents → operator corroborates the receipt and statement and documents the identification.
- A same-amount transfer could be distinct → preserve the existing four-day competitor rejection and inspect both accounts.

## Migration Plan
Run focused and full tests and validate the spec before use; plan and inspect the candidate, then apply under the existing lease and backup workflow. Revert code only after completed audits are preserved.
