# Multi-child historical split correction Implementation Plan

> **For agentic workers:** Execute the OpenSpec tasks in order with TDD.

**Goal:** Correct explicitly evidenced multiple child amounts in one verified operation.

**Architecture:** Extend the existing split-correction candidate with a mutually exclusive childAmounts array; retain exact snapshots, backup, readback, audit and legacy candidate form.

**Tech Stack:** Node 22.20.0, node:test, Actual official Node API, OpenSpec.

**Spec:** openspec/changes/correct-evidenced-multi-split-amount/specs/actual-historical-split-amount/spec.md

## Global Constraints

Preserve all transaction fields except explicit amounts; do not touch other budgets; lease, lock, backup and independent full readback remain mandatory.

## Steps

1. In scripts/actual-split-amount.test.mjs add failing tests for two distinct children, duplicate/unknown/unchanged children, mixed formats, mismatched totals, audit retry and unrelated mutation.
2. Run `node --test scripts/actual-split-amount.test.mjs` under nvm Node 22.20.0 and confirm the new valid case fails.
3. Update scripts/actual-split-amount.mjs to normalize legacy versus multi-child fields, validate exact identities and sums, and apply all children in one write.
4. Run the focused tests, then `node --test scripts/*.test.mjs` and `go test ./...`.
5. Update docs/actual-gmail-runbook.md, complete OpenSpec tasks, validate and archive; apply financial candidate only after independent evidence and plan agree.
