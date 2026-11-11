# Correct Cleared Historical Split Date Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; tasks use checkboxes.

**Goal:** Correct an independently evidenced cleared historical split date without altering its identity or contents.

**Architecture:** A dedicated adapter module classifies exact snapshots, refuses ledger ownership and unsafe states, writes pending audit before the official parent update and independently verifies the whole budget. A real Actual API test uses an isolated offline temporary budget.

**Tech Stack:** Node 22.20.0, node:test, official Actual API, OpenSpec.

**Spec:** openspec/changes/correct-cleared-historical-split-date/specs/actual-historical-split-date/spec.md

## Global Constraints

Never modify reconciled, scheduled, ledger-owned, unrelated transactions or budgets; no direct database writes. Evidence IDs do not establish document contents. Preserve all fields and balances; pending audit prevents automatic replay. Use the existing run lease and writer lock.

## Review Focus

Partial writes, parent API propagation, cleared and reconciled flags, ledger ownership in children, and simultaneous destination duplicates.

## Tasks

- [x] Write classification and lifecycle tests, see them fail, implement minimal dedicated module, then pass them.
- [x] Exercise the operation through the real official API in a temporary offline budget; verify all fields and retry.
- [x] Integrate dispatcher, document operation, run the relevant suite and validate OpenSpec before archiving.
