## ADDED Requirements

### Requirement: Reconstruct a mixed wallet component of an existing categorized split
For an evidenced Uber Eats order whose existing card component is a verified split between groceries and alcohol, the adapter SHALL accept the exact parent, children and original Gmail ledger snapshot, receipt and card statement, both payment amounts and category subtotals. The operator SHALL inspect the complete receipt and existing entries. It SHALL compute the category allocation for the entire order by proportional largest-remainder rounding and create only the wallet split whose children are the difference between that allocation and the existing card children. It SHALL preserve the original parent, child rows, source ledger, categories and shared receipt identity, require an owned lease, lock, full-budget and stable-ledger digest, backup, pending intent, and independent full readback. Pending intent SHALL block other financial writes; completed exact retries SHALL verify without writing while tolerating unrelated later wallet entries.

#### Scenario: Verified grocery and alcohol order
- **WHEN** card and wallet portions sum to the order, the original split and ledger match, and category weights are supported by the complete receipt
- **THEN** the adapter SHALL create exactly one wallet parent with category children equal to the proportional full-order allocation less the existing card categories.

#### Scenario: Conflicting amounts, sources or state
- **WHEN** any child, source ownership, total, category, source evidence, potential duplicate or plan snapshot conflicts
- **THEN** it SHALL stop without writing and SHALL NOT invent a different source identity.
