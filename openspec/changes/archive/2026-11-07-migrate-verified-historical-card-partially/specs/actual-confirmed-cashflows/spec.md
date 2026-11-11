## ADDED Requirements

### Requirement: Preserve audited legacy line evidence through migration
For an already registered line transfer whose exact legacy matching pair was moved by a completed verified historical account migration, the adapter SHALL preserve the original evidence snapshots unchanged and MAY verify the live pair through the exact old-to-new snapshots recorded in that completed migration audit. This exception SHALL apply only to the same previously registered source and exact original candidate; missing, pending, altered or ambiguous mappings SHALL remain in review.

#### Scenario: Verify previously registered transfer after migration
- **WHEN** a completed migration records exact old and new legacy pair snapshots and the original registered candidate and current pair match those snapshots
- **THEN** a retry SHALL verify the existing transfer without a new write.

#### Scenario: Mismatched or incomplete migration evidence
- **WHEN** the migration is pending, its mapping differs, the current pair changed or another source tries to use the mapping
- **THEN** the adapter SHALL return review without writing.
