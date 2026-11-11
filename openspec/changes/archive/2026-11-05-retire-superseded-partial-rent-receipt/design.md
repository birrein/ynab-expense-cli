## Context

The current retirement operation checks identical amounts for a historical duplicate and its bank-backed transaction.

## Goals / Non-Goals

**Goals:** Support an explicit evidence-gated partial amount, without weakening ordinary duplicate checks.

**Non-Goals:** Inferring that two unrelated payments are the same, or adjusting either retained expense.

## Decisions

An explicit `partialReceipt` contains the old amount, shared receipt identity and distinct initial and final Gmail message IDs. The old notes must include the receipt identity and retained notes the final message. Both transactions must share account and category and the final absolute value must exceed the old. The operator must manually inspect both receipt versions and the bank statement.

## Risks / Trade-offs

Mistaking partial payments for independent payments → require the receipt identity and statement confirming only one final charge; otherwise leave untouched.
