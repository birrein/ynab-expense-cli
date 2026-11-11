## ADDED Requirements

### Requirement: Preview explicit append-only tag amendments

The adapter SHALL accept a dedicated `transactionTagAmendment:true` operation specifying one `tag` matching `#[A-Za-z][A-Za-z0-9_-]{0,63}`, exact original notes and the same resolved transaction identity, provenance and ledger preconditions as descriptive corrections. It SHALL preserve the exact original notes as a prefix and append only the requested tag on a separate final line. It SHALL reject mixed operation flags, replacement text fields, multiple tags, malformed tags and arbitrary metadata changes. Descriptive replacement SHALL retain its existing hashtag protections.

#### Scenario: Preview a trip tag
- **WHEN** a valid candidate requests an absent travel tag for a matching categorized expense
- **THEN** plan displays exact original notes and proposed notes with only the requested tag appended
- **AND** plan does not mutate financial or ledger state

#### Scenario: Reject metadata rewriting
- **WHEN** a tag candidate contains replacement fields, conflicting operations, newline injection or an invalid tag
- **THEN** the adapter rejects it before mutation

### Requirement: Avoid duplicate tags

The adapter SHALL recognize complete hashtag tokens outside URLs, comparing tag names case-insensitively without changing their existing spelling. It SHALL preserve a single existing occurrence as a no-op and SHALL reject multiple existing occurrences for review. Similar tag prefixes/suffixes and URL fragments SHALL NOT count as the requested tag.

#### Scenario: Already tagged
- **WHEN** original notes contain one occurrence of the requested tag, including a case variant or punctuation boundary
- **THEN** plan proposes unchanged notes and apply independently verifies without mutation, another backup or a new amendment audit

#### Scenario: Existing duplicates
- **WHEN** original notes contain multiple occurrences of the requested tag
- **THEN** the adapter stops without inserting or removing any tag

#### Scenario: Similar tag or URL fragment
- **WHEN** only a longer tag, a shorter tag or a URL fragment matches the requested spelling partially
- **THEN** the requested standalone tag is appended while preserving all existing content

### Requirement: Verify tag writes with existing amendment safeguards

The adapter SHALL apply tag additions only with explicit commit, the owning lease and exclusive lock, a private backup, final pre-write state checks, synchronization and a separate download. It SHALL verify the exact append-only notes and unchanged sources, existing tags, target fields, unrelated transactions, catalog, rules, schedules and balances. Only after verification SHALL it append tag-specific amendment audit to the original ledger records, preserving existing histories, other fields, unrelated records and review checkpoints. It SHALL NOT modify Gmail labels. An identical retry at exact desired notes SHALL independently verify and recover audit without repeating mutation.

#### Scenario: Verified tag addition
- **WHEN** independent readback matches the expected snapshot with only the requested tag appended to the target notes
- **THEN** apply reports the original transaction ID as verified and records the tag addition audit

#### Scenario: Lease, backup, sync or invariant failure
- **WHEN** ownership, backup, sync, exact preconditions or independent readback fails
- **THEN** the adapter stops without claiming success, stealing another lease, removing another lock or advancing review checkpoints
