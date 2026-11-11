## RENAMED Requirements

- FROM: `### Requirement: Preview explicit append-only tag amendments`
- TO: `### Requirement: Preview explicit leading tag amendments`

## MODIFIED Requirements

### Requirement: Preview explicit leading tag amendments

The adapter SHALL accept a dedicated `transactionTagAmendment:true` operation specifying one `tag` matching `#[A-Za-z][A-Za-z0-9_-]{0,63}`, exact original notes and the same resolved transaction identity, provenance and ledger preconditions as descriptive corrections. It SHALL preserve the exact original notes as a suffix and prepend only the requested tag on a separate first line. It SHALL reject mixed operation flags, replacement text fields, multiple tags, malformed tags and arbitrary metadata changes. Descriptive replacement SHALL retain its existing hashtag protections.

#### Scenario: Preview a trip tag
- **WHEN** a valid candidate requests an absent travel tag for a matching categorized expense
- **THEN** plan displays exact original notes and proposed notes with only the requested tag prepended
- **AND** plan does not mutate financial or ledger state

#### Scenario: Reject metadata rewriting
- **WHEN** a tag candidate contains replacement fields, conflicting operations, newline injection or an invalid tag
- **THEN** the adapter rejects it before mutation

### Requirement: Verify tag writes with existing amendment safeguards

The adapter SHALL apply tag additions only with explicit commit, the owning lease and exclusive lock, a private backup, final pre-write state checks, synchronization and a separate download. It SHALL verify exact leading-tag notes and unchanged sources, existing tags, target fields, unrelated transactions, catalog, rules, schedules and balances. Only after verification SHALL it append tag-specific amendment audit to the original ledger records, preserving existing histories, other fields, unrelated records and review checkpoints. It SHALL NOT modify Gmail labels. An identical retry at exact desired notes SHALL independently verify and recover audit without repeating mutation.

#### Scenario: Verified tag addition
- **WHEN** independent readback matches the expected snapshot with only the requested tag prepended to the target notes
- **THEN** apply reports the original transaction ID as verified and records the tag addition audit

#### Scenario: Lease, backup, sync or invariant failure
- **WHEN** ownership, backup, sync, exact preconditions or independent readback fails
- **THEN** the adapter stops without claiming success, stealing another lease, removing another lock or advancing review checkpoints

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
- **THEN** the requested standalone tag is prepended while preserving all existing content

## ADDED Requirements

### Requirement: Preview and verify existing hashtags first

The adapter SHALL accept a dedicated `transactionTagsPrefixAmendment:true` operation with exact existing categorized simple-expense identity, authoritative ledger sources, old notes and evidence. It SHALL reject replacement/tag fields and mixed operations. It SHALL move only complete existing standalone hashtags outside URLs and source metadata to one leading line, preserving spelling and encounter order. It SHALL preserve all other content except whitespace at touched line edges and now-empty tag lines, preserve source links exactly, and reject case-insensitive duplicate tags and ambiguous glued hashtag sequences. No tags or already canonical notes SHALL produce a verified no-op without backup or new audit. Malformed or discordant provenance SHALL stop without reconstructing a source.

#### Scenario: Preview multiple inline and trailing tags
- **WHEN** matching notes contain distinct standalone hashtags in prose and on trailing lines
- **THEN** plan displays those exact tags first and the preserved remaining content without writing

#### Scenario: URL fragment and concatenated source
- **WHEN** a hashtag-like fragment is part of a URL or the required Gmail source is not an exact standalone line
- **THEN** the fragment is never moved or split and malformed provenance rejects the amendment

#### Scenario: Verified relocation and retry
- **WHEN** the operator applies a valid relocation with explicit commit, owned lease, free lock and successful backup
- **THEN** the adapter revalidates, patches only notes, syncs and independently downloads the full budget to verify all financial data and unrelated content unchanged before adding `prefix-tags` audit
- **AND** an identical retry at exact desired notes verifies and recovers audit without another write or backup

#### Scenario: Duplicate or unsafe relocation
- **WHEN** notes contain duplicate hashtag names or any identity, ledger, ownership, backup, sync or readback check fails
- **THEN** the adapter stops without removing duplicates, success audit or checkpoint advancement

### Requirement: Prefer leading hashtags on future creation

When creating transactions the adapter SHALL place existing authorized hashtags from candidate descriptions on the first line before descriptive text and generated provenance, including split descriptions, without inventing tags, changing link bytes or silently removing duplicate tags. Existing duplicates SHALL require review before creation. This formatting SHALL NOT rewrite notes on existing-source verification or category resolution.

#### Scenario: Create with authorized trailing tag
- **WHEN** a new candidate description contains a trailing authorized hashtag and valid provenance
- **THEN** the transaction notes begin with that hashtag and preserve useful text and all generated source lines

#### Scenario: Preserve existing-source notes
- **WHEN** a candidate resolves or verifies a transaction that already exists
- **THEN** its original notes are preserved unless a separate explicit notes operation is applied
