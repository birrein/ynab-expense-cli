# actual-aggregate-transfer-deduplication Specification

## Purpose
Preserve independently evidenced individual own-account transfers while retiring a duplicate historical aggregate pair.

## Requirements

### Requirement: Retire an evidenced aggregate transfer pair
The adapter SHALL require exact historical reciprocal legs and at least two independently source-ledgered reciprocal component transfers, each on the same date and accounts, whose amounts sum exactly to the aggregate and whose evidence identifies the bank statement. The original historical provenance SHALL be retained in audit and all other records SHALL remain unchanged.
#### Scenario: Duplicate historical aggregate with complete evidence
- **WHEN** both historical legs and all distinct component pairs match their sources, date, accounts and exact sum
- **THEN** the adapter backs up, revalidates and deletes only the two aggregate legs through the official API, synchronizes and independently verifies both balances and all other records.
#### Scenario: Conflict or incomplete result
- **WHEN** any pair, amount, source, ledger, account or audit conflicts
- **THEN** the adapter fails closed without another financial mutation.
#### Scenario: Exact retry
- **WHEN** the same retirement has been independently verified and audited
- **THEN** the adapter verifies the evidence and audit without deleting again.
