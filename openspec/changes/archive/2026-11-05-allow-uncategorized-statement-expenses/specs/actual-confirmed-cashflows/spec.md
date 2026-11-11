## ADDED Requirements
### Requirement: Retain uncategorized confirmed statement expenses for review
The adapter SHALL allow a settled negative expense with verified account, date, amount and statement evidence and an explicit category-pending reason to be recorded without a category. It SHALL return and audit Review status, preserve unique sources and reject uncertain payment, currency or account through existing evidence rules.

#### Scenario: Confirmed uncategorized charge
- **WHEN** a valid statement expense has no category and includes a reason
- **THEN** the adapter previews and records the confirmed charge without category, and marks it for Review with backup and independent verification.

#### Scenario: Missing reason or conflicting category
- **WHEN** an uncategorized charge lacks a reason or an explicit category is invalid
- **THEN** the adapter rejects it without writing.
