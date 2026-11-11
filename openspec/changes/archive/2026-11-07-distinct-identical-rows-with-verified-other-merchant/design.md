## Context

The identical-row exception currently requires exactly one nearby match. A verified other merchant on the same statement introduces a second match. Source IDs and accounting must still identify the two identical rows unambiguously.

## Goals / Non-Goals

**Goals:** Add a narrow optional second verified match to the existing exception without changing its behavior when omitted.

**Non-Goals:** Establish the meaning of statement rows automatically, weaken any duplicate guard, or change already posted transactions.

## Decisions

Add optional `otherMerchant` with an exact prior transaction snapshot, its prior merchant name and evidence. Require the same account, date, amount, shared statement and a verified ledger source, distinct normalized merchants and imported source IDs, independent notes and no reused Gmail sources. Require the two prior IDs to equal all nearby matches. Retain row ordinals and existing statement arithmetic tolerance. The operator remains responsible for inspecting the entire statement and proving the three rows and totals. An unrestricted match array was rejected because it widens the exception unnecessarily.

## Risks / Trade-offs

A statement may omit reversals or hide an earlier aggregate; reject uncertain evidence, preserve source IDs and perform independent readback. For existing unmodified candidates, retaining their original validation is essential for idempotent recovery.
