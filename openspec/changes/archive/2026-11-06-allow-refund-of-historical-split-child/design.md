## Context

Ordinary refunds validate only simple parent transactions. Historical split parents and children are returned nested by snapshots, while user evidence identifies a particular child.

## Goals / Non-Goals

**Goals:** Extend the existing refund path without modifying the historical parent and preserve all existing financial checks.

**Non-Goals:** Cross-account or inferred multi-category refunds; changing the original transaction.

## Decisions

A candidate explicitly supplies the exact split snapshot, statement ID and merchant message ID; its refundOf field is the child ID. Validate the snapshot and child membership, amounts, account, date, category, evidence, prior linked refunds and duplicate source. Existing create and independent readback machinery adds the separate credit and verifies unchanged parent and balances. Parent-linked prior refunds are ambiguous and block. Cross-account exceptions do not apply to split children.

## Risks / Trade-offs

Unlinked older refunds cannot be unambiguously attributed automatically; the existing nearby same-amount guard and manual full-history review remain necessary. Evidence identifiers do not replace reading the evidence.
