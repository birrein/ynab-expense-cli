## ADDED Requirements

### Requirement: Verify an owned transfer after a posting-date correction
The adapter SHALL recognize the exact original cashflow candidate only when a single complete posting-date audit links its unchanged original ledger and snapshots to the exact current reciprocal legs. It SHALL independently verify the result without rewriting the original ledger or creating new movements. Pending, absent, altered, ambiguous or unrelated audit chains SHALL remain in review.

#### Scenario: Exact original retry after a complete correction
- **WHEN** the original candidate, unchanged original ledger and verified corrected legs match one complete linked audit
- **THEN** the adapter verifies the existing pair without a financial or ledger write.

#### Scenario: Invalid audit chain
- **WHEN** the original candidate, ledger, audit status, snapshots or corrected legs differ or multiple audits claim the source
- **THEN** the adapter returns review and writes nothing.
