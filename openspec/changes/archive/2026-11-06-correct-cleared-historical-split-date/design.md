## Context
Actual split parents contain nested children; direct child edits have caused corruption. Cleared and reconciled flags are distinct. See proposal and spec for scope.

## Goals / Non-Goals
**Goals:** Preserve the entire historical split and account totals while correcting an independently evidenced posting date.
**Non-Goals:** Editing reconciled items, installments, ledger-owned records, provenance, categories, amounts, or broad bulk changes.

## Decisions
A dedicated exact-snapshot operation validates the live split, an independently read Gmail receipt and bank statement IDs, and requires same-month movement up to seven days and explicit cleared preservation. Source IDs alone do not prove document contents; the operator verifies them. An audit is saved pending before the official parent update. Independent full-budget readback matches a snapshot with only parent and child dates changed and completes audit; pending or unexplained writes cannot be retried automatically. Test actual API semantics on a synthetic offline budget before real application. Recreating transactions risks duplicates and changing children individually risks corruption, so neither is used.

## Risks / Trade-offs
API parent updates may propagate unexpected fields → characterize with a real isolated API budget, preserve needed fields, and verify every field. External concurrent change after revalidation → whole-budget comparison detects but cannot prevent it; retain backup and pending audit for investigation.
