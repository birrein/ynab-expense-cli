## ADDED Requirements

### Requirement: Allow explicit receipt evidence for untagged historical totals

The adapter SHALL accept an original without an installment tag only when an explicit receipt-evidence declaration binds the original transaction ID, account, purchase date and total, purchase message ID, card last four digits and installment count to the candidate. It SHALL reject missing, malformed, extra or inconsistent fields. The operator MUST independently inspect the receipt and all statements and establish that they describe the same purchase and account. The adapter SHALL preserve original notes without manufacturing a tag, and all existing series, account, ledger, duplicate, backup and verification requirements SHALL remain in force. A supplied declaration SHALL always be checked, including for tagged originals.

#### Scenario: Untagged original with complete matching receipt evidence
- **WHEN** the original is untagged and the exact declaration, inspected receipt and complete statement series match it
- **THEN** the adapter permits the normal preview and verified replacement without adding an invented tag.

#### Scenario: Absent or inconsistent declaration
- **WHEN** an untagged original has no declaration or a supplied declaration conflicts with the original or series
- **THEN** the adapter rejects the candidate before any financial write.
