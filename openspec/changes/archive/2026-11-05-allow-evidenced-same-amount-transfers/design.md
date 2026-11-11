## Context

Current cashflow duplicate checks compare each account across four days. A same-day destination credit can be legitimate from a different origin; existing source identity remains authoritative for retries.

## Goals / Non-Goals

**Goals:** permit only a specifically identified distinct reciprocal transfer pair, grounded in independent reviewed receipts and a shared statement, while retaining all other duplicate checks.

**Non-Goals:** automatic bank document parsing, arbitrary exception strings, overriding source identity conflicts, or relaxing expense/income duplicate rules.

## Decisions

Add a structured `distinctTransfer` with existing origin and destination transaction IDs, distinct existing-origin Gmail source IDs, a statement file ID already included in the candidate and an explanation. Require exactly one conflicting destination leg and exact reciprocal origin from another active account, same date and amount. Reject any other conflict, overlap in evidence IDs, altered identity or unsupported candidate type. The operator independently reads the two origin receipts and both rows on the destination statement; these inputs are retained in the candidate backup and audit. A simple free-form override would allow accidental duplication and is excluded.

## Risks / Trade-offs

- Evidence may be misinterpreted → require explicit operator verification of original sources and complete statement, without claiming the adapter parses them.
- Concurrent changes → revalidate using the current snapshot and lease before write and verify the previous pair and all unrelated entries afterwards.
