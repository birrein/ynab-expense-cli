# Financed Historical Installments Implementation Plan

> **For agentic workers:** Implement tasks sequentially, using test-driven development and the approved user instruction to work autonomously. OpenSpec tracks this work.

**Goal:** Safely replace a financed historical card purchase total with the complete series billed in statements, adding the explicitly verified finance cost exactly once.

**Architecture:** Extend the existing audited historical card total replacement with an optional strict Drive evidence and positive financing-cost declaration. Retain the purchase category and expose the series-level cost in notes; do not infer interest per installment. Independently verify that only the source account balance changes by the declared cost.

**Tech Stack:** Node 22.20.0, node:test, official Actual API adapter, OpenSpec.

1. Add financed candidate validation tests, including mismatches, negative amounts, untagged receipts, source uniqueness and compatibility; run the tests and confirm the new behavior fails.
2. Implement validation and notes, ensuring all pre-existing criteria remain mandatory; run tests.
3. Add mock runtime tests that calculate real balance changes, validate unrelated account and transaction invariants, interruption and retry; run tests.
4. Implement readback balance verification and audit; run targeted and adjacent adapter regression tests.
5. Update runbook, validate and archive OpenSpec. Only then inspect live evidence, plan, apply with lease/backup and verify independently.
