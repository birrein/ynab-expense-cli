## Context

Cashflow source IDs already support exact retry. Current apply asserts a payee exists after backup, although preview does not verify it. Official Actual API supports payee creation.

## Goals / Non-Goals

**Goals:** Permit missing exact ordinary payees only for otherwise valid bank cashflows, preserving source identity and independent verification.

**Non-Goals:** Renaming or merging payees, changing transfer payees, creating categories, inferring source evidence, or changing existing transaction meaning.

## Decisions

Normalize names for ambiguity detection; exact single ordinary match is reusable and any nonexact normalized match or transfer conflict requires review. Report the planned payee operation explicitly. The owning lease and full-budget snapshot are revalidated after backup, then the official API creates the payee if necessary and posts the cashflow. Independent readback checks exact allowed payee delta as well as every existing financial invariant. Source-based retries reuse an already created exact payee; a source conflict remains Review.

## Risks / Trade-offs

- A failure after payee creation but before movement leaves an unused payee; retry verifies its exact name and reuses it without a second create.
- Actual has no atomic compare-and-set; independent readback detects concurrent modifications but cannot prevent changes after the final prewrite snapshot.
