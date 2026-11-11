## Context

A completed migration audit deliberately checks excluded snapshots on retries. A gross and net purchase can be in two linked accounts with a verified refund, but the current duplicate operation requires one account and an owned retained bank source.

## Goals / Non-Goals

**Goals:** Narrow evidence-gated correction; immutable migration and retirement histories; independently verified net result.

**Non-Goals:** General account consolidation, automatic refund detection, deletion of other exceptions, or inferring evidence from numerical identity.

## Decisions

- Use a dedicated candidate containing exact original transactions, completed migration digest, distinct bank purchase/refund references, statement identifier, three independently read Gmail IDs and reviewed evidence. Alternative of broadening existing same-account duplicate operation weakens its existing invariants.
- Bind plan to full budget and stable ledger with SHA-256; pending intent written before deletion blocks all financial writes until investigated. One deletion uses the official API. Reconnect independently and compare every row, account balance, categories, payees, rules, schedules and dashboards.
- Keep the migration audit immutable; its read-only retry recognizes only an exact completed retirement audit containing matching candidate, gross snapshot and unchanged retained snapshot. A pending or duplicate audit is insufficient.
- Compare source references across ledger and other rows and reject any separately represented refund; the operator must inspect the complete statement and receipts rather than relying on code as evidence.

## Risks / Trade-offs

- A net row cannot represent both banking dates separately → document original dates and references in the immutable audit; no refund is recorded twice.
- Concurrent external clients are not controlled by the lease → detect changes by full revalidation and readback, retaining pending intent if interrupted.

## Migration Plan

Run negative and integration tests, verify the original migration retry with and without matching retirement audit, validate OpenSpec, execute a fresh live plan under lease only after sources are confirmed, independently read back, document, then archive the spec. If interrupted, inspect backup and audit before any recovery; never repeat automatically.
