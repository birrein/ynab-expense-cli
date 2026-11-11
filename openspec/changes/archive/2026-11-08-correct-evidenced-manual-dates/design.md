## Context

Receipt and bank statements sometimes show that a legacy manual date is wrong, not a bank processing delay. Existing safeguards must remain intact for normal posting corrections.

## Goals / Non-Goals

Support explicit forward corrections of one to seven days when the receipt and statement dates agree. Do not infer dates from balances, alter other fields, or create transactions.

## Decisions

Require `historicalDateUnreliable:true` with the existing complete statement evidence for categorized expenses, or with two matching statement dates for transfers. The receipt date must equal the new date. Require statement coverage for both expense dates, check nearby same-amount competitors near both old and new dates, and preserve exact snapshot, source, hash, lease, backup, pending-audit and independent readback protections. Reusing the normal posting-delay mode without an explicit marker was rejected because it would conflate different evidence.

## Risks / Trade-offs

The operator must personally establish identity and account ownership from independent evidence. A numerical coincidence cannot prove a match. Interrupted writes remain pending and block later writes until investigated.
