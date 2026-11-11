## Context

The existing exception only distinguishes different merchants. The bank statement is authoritative but identical text at a page boundary can be either two transactions or duplicated rendering.

## Goals / Non-Goals

**Goals:** Admit exactly two inspected rows, retaining the prior verified ledger entry and testing full statement totals as independent corroboration.

**Non-Goals:** Infer same-day duplicates from row count alone, support arbitrary batches, or accept an unverified prior record.

## Decisions

Require the same payee, account, date and amount; an exact prior transaction snapshot and verified source with the same statement; stable paired source suffixes `:row1of2` and `:row2of2`; no other nearby matching transactions; explicit review reason for unknown category; and an accounting declaration in cents with previous bill, payments, operation sum, finance charges and current bill. The full sum must differ by at most CLP 10 due to statement rounding; removing a row must fail that same tolerance. The operator must read and add all statement rows, inspect payments and charges and establish that the declaration represents the actual statement. The declaration is evidence metadata, not an independent document verifier.

## Risks / Trade-offs

A mathematically plausible but misread statement could still be wrong; independent operator inspection and exhaustive matching remain mandatory. This narrow flow handles two occurrences only.
