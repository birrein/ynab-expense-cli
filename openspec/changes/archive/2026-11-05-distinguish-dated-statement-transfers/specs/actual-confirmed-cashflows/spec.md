## ADDED Requirements
### Requirement: Distinguish a different-date statement-backed transfer
The adapter SHALL allow a unique matching destination transfer within the duplicate window only if the candidate explicitly identifies its exact reciprocal origin pair, separate Gmail evidence, and a verified shared destination statement showing distinct credits on different dates. The candidate SHALL also cite an independently verified statement of its own origin, and preserve all evidence and duplicate checks.

#### Scenario: Distinct line draw and later incoming transfer
- **WHEN** both statements verify the new line draw and the identified reciprocal pair is backed by a separate source and a later statement row
- **THEN** plan can propose the new transfer, with backup, revalidation and independent verification as usual.

#### Scenario: Insufficient evidence or additional match
- **WHEN** evidence, dates, accounts, source or reciprocal identities conflict or any other potential duplicate exists
- **THEN** the adapter leaves the candidate in review without writing.
