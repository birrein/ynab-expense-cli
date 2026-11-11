# Evidenced Cross-Currency Debt Transfer Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; check off tasks as completed.

**Goal:** Record the two statement-confirmed legs of a card debt transfer between CLP and USD budgets without double-counting consumption.

**Architecture:** A directed adapter module preflights and backs up both budgets, persists pending audit before writes, and independently reloads and compares both entire snapshots. It uses existing transfer-exclusion categories and shared reference; it never computes a rate or creates a native cross-budget link.

**Tech Stack:** Node 22.20.0, official Actual API, node:test, OpenSpec.

**Spec:** openspec/changes/record-evidenced-cross-currency-debt-transfer/specs/actual-evidenced-cross-currency-debt-transfer/spec.md

## Global Constraints

No inferred exchange rate, no additional writer, no SQL, no new categories or account, no unrelated budget edits, one existing lease and lock. A pending audit prevents blind retries.

## Review Focus

Partial first/second writes, source duplication, category/report semantics, balance verification, concurrent changes.

## Tasks

- [x] Write focused failing validation and partial-write tests, implement until they pass.
- [x] Exercise category and readback semantics via official API in isolated offline budget.
- [x] Integrate and document, run full relevant tests, validate and archive OpenSpec.
