## ADDED Requirements

### Requirement: Convert an independently evidenced historical incoming credit
The adapter SHALL allow conversion of a precisely identified uncategorized historical standalone positive credit into a reciprocal own-account transfer only when the operator has independently checked a sender receipt and destination statement, and no possible origin debit exists. It SHALL preserve the historical credit ID, account, date, amount and other unrelated fields, replace obsolete notes with linked provenance, add exactly one opposite origin leg, and not fabricate a historical imported source.

#### Scenario: Confirmed incoming own transfer
- **WHEN** exact live credit identity, sender receipt, destination statement and account ownership match and no other plausible origin debit exists
- **THEN** preview proposes conversion and commit requires lease, lock, backup, revalidation and pending audit before writing, then synchronizes, independently verifies both legs, all balances and unrelated records, and completes the audit.

#### Scenario: Conflicting identity, evidence or duplicate
- **WHEN** any source, account, note, amount, identity, ownership, prior audit, transfer link or possible duplicate conflicts
- **THEN** the operation SHALL stop without a financial write.

#### Scenario: Interrupted or exact completed conversion
- **WHEN** a write was interrupted or a pending audit exists
- **THEN** it SHALL stop for investigation; a retry after complete audit SHALL verify the exact linked pair without another write.
