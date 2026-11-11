## Context

The existing series operation saves a pending candidate and private backup before updating dates; its final independent read may fail even after all three writes reached the server. Current code correctly blocks retries and lacks a recovery path.

## Goals / Non-Goals

**Goals:** Recover only after confirming the complete intended transformation against its original backup, with the same lease and lock and original audit provenance.

**Non-Goals:** Retrying writes, recovering partial changes, rolling back a budget, ignoring unrelated changes or overwriting another audit.

## Decisions

Use a dedicated explicit recovery candidate referencing the exact original purchase message and candidate. Load the pending record and trusted before.json and saved candidate from the private backup; check exact equality and active budget identity. Download a fresh independent server snapshot and compare every transaction by unique ID and all other collections to before.json, allowing only candidate date replacements. Save the verified read-back in the original backup, then re-read the pending audit under the lease and atomically mark it complete with recovery provenance. Existing normal retry remains unchanged.

Alternatives rejected: manually change the state file, which has no repeatable safeguards; replay the normal writer, which can duplicate or damage partial state; accept individual matches while overlooking unrelated changes.

## Risks / Trade-offs

- Concurrent legitimate changes → fail closed and investigate instead of ignoring them.
- Backup tampering or mismatch → reject missing or mismatched candidate/backup and preserve pending state.
- Read-back failure → leave pending and do not mutate transactions or audit.
