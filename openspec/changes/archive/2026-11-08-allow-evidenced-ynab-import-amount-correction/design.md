## Context

The existing operation verifies the exact snapshot, backs up, revalidates and updates only the amount, but forbids any imported identifier. The source ledger and unrelated budget data must remain intact.

## Goals / Non-Goals

**Goals:** Permit a narrow CLP correction of a unique YNABEXP import using a bank statement, original bank notice, original order and final goods receipt read independently by the operator.

**Non-Goals:** Do not generalize to other import namespaces, transfers, installments, splits, reconciled entries or ledger-owned entries; do not infer that identifiers themselves establish evidence.

## Decisions

Use an exclusive `importedAuthorizationEvidence` object with three distinct Gmail IDs, a receipt number present in the original notes, final goods and original service amounts. Require a unique exact `YNABEXP:` identifier, whole-peso negative amounts, a correction within CLP 500 and 5%, and a bank total within CLP 1 of goods plus the stated service. The operator must independently read all sources and confirm they describe one purchase and that the service is appropriately considered. Preserve the existing readback, backup, lease, ledger checks and retry behavior. Rejecting all imports would leave the confirmed posted discrepancy unresolved; a general import override would weaken deduplication protections.

## Risks / Trade-offs

A prior service charge does not prove a final service charge. The one-peso tolerance and the calculated figure are corroboration only; the operator must confirm identity and take the posted bank amount, with any unverified detail described honestly. Source identifiers remain unchanged to preserve deduplication. A failure after writing but before audit requires inspecting backup and live state; never retry by changing identity.
