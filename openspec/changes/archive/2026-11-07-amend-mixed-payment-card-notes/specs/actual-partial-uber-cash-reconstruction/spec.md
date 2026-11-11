## ADDED Requirements

### Requirement: Preserve mixed-payment audit while correcting a card note
The adapter SHALL permit an explicitly evidenced literal text correction on the card row of a completed mixed-payment group while preserving its original audit and source record. It SHALL protect links, tags, source metadata and every field other than the selected note text, require an exact complete original group, full snapshot and ledger plan digest, owned lease and lock, backup, revalidation and durable pending amendment intent, and independently verify the entire budget before completing the amendment. Any pending intent SHALL block other financial writes. A subsequent original-group retry SHALL accept the changed note only through the exact complete amendment audit and otherwise fail without writing.

#### Scenario: Card note correctly amended
- **WHEN** the original group and note match, and the requested replacement does not intersect source metadata or tags
- **THEN** only that note text SHALL change, with an independently verified amendment audit that preserves both wallet and card components.

#### Scenario: Interrupted or unverified amendment
- **WHEN** the amendment is pending, the original group changed, or the amendment audit is absent or altered
- **THEN** the operation SHALL fail closed without further financial writes.
