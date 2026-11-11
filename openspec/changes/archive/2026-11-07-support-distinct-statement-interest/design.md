## Context

The cashflow adapter treats equal nearby credits as possible duplicates even when daily provider statements include a unique reference per credit.

## Goals / Non-Goals

**Goals:** Admit only independently inspected distinct rows and preserve all duplicate checks for other cases.

**Non-Goals:** Inferring an income, merging daily rows, changing prior entries or bypassing any source conflict.

## Decisions

The candidate supplies `distinctVerifiedStatementIncome` with evidence and the complete set of nearby prior conflicts: each exact transaction snapshot, unique bank source and verified statement ID. The operator independently inspects the PDF and each line; identifiers do not prove document content. Validate every prior source against the cashflow ledger, category, payee, date, account, amount, statement and transaction; require different dates and unique sources. The candidate source and statement must be distinct from the prior sources. Verify exact equality between supplied and discovered conflict sets. Existing cashflow lease, backup, revalidation and independent readback remain mandatory. Before this exception writes, persist a pending intent that reserves its sources across financial routes; incomplete intents fail closed. Readback may recognize only the ID just created under that exact intent. Completed retries verify ledger and intent identity and are read-only.

## Risks / Trade-offs

- Similar amounts can be duplicates: reject missing, extraneous, ambiguous or changed conflicts, including sources already owned elsewhere.
- A prior row may be on a different monthly statement: require and verify each individual prior statement ID in its verified ledger record.
