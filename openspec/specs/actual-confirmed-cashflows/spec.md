# actual-confirmed-cashflows Specification

## Purpose
Safely register verified incoming funds and own-account bank transfers while retaining provenance and avoiding duplicate charges.

## Requirements

### Requirement: Preview verified cashflows
The adapter SHALL require an explicit currency, account identity, date, integer amount, stable unique source, corroborating evidence and complete source links. Own-account transfers SHALL identify both active accounts in the same budget and be supported by both origin and destination evidence. It SHALL reject ambiguous matches, unsupported currency, existing or potentially duplicate entries and mixed operation fields, except for an explicitly evidenced distinct transfer whose exact existing reciprocal pair has a different origin account and the same destination, date and amount, and whose separate origin receipts and shared destination statement have been reviewed; or an independently inspected distinct interest-income row and its complete set of nearby, separately sourced and already verified ledger matches; or a separately evidenced line-of-credit transfer with an exact historical income or reciprocal historical transfer identified as the sole conflicting movement on a distinct statement date; or a differently dated, separately evidenced repayment of the same line whose only conflicting pair is already verified in the cashflow ledger; or the exact historical same-origin pair of the same amount within four days to a different destination, with distinct rows and recipient evidence independently inspected; or an exact verified cashflow-owned pair of the same amount within four days to a different destination, with a shared origin statement, distinct recipient evidence and prior source independently verified.

#### Scenario: Transfer preview
- **WHEN** a uniquely verified own-account transfer has no candidate match on either side
- **THEN** preview proposes one native linked transfer without writing.

#### Scenario: Distinct transfers with identical destination and amount
- **WHEN** the candidate names the only matching destination leg and its reciprocal origin leg, a different origin, a separately identified existing-origin receipt, and a verified statement containing both deposits
- **THEN** preview may propose the new transfer while preserving the existing pair and all source identities.

#### Scenario: Unexplained additional match or conflict
- **WHEN** any matching transaction is not the identified pair, evidence overlaps or is missing, same-origin evidence is insufficient, the links are not reciprocal, or a new source conflicts with an existing one
- **THEN** the candidate remains in review without a financial write.

#### Scenario: Distinct line transfer and legacy match
- **WHEN** the operator has independently reviewed a shared statement and a separate receipt establishing the historical income or reciprocal card-payment transfer as a different dated row of the same amount, and provides exact snapshots for every relevant legacy leg
- **THEN** the adapter SHALL permit only that line transfer if it covers the entire conflict set, preserves all historical legs, and otherwise satisfies source, backup, lease and independent readback controls.

#### Scenario: Changed legacy match or unsupported conflict
- **WHEN** a legacy snapshot, linked leg, receipt, statement date, sign, account or conflict set disagrees
- **THEN** the adapter SHALL return review without writing.

#### Scenario: Distinct repayments to the same line
- **WHEN** the operator inspects a shared statement showing distinct dated repayment rows and identifies the sole nearby conflict as an exact verified reciprocal pair for the same origin, destination and amount
- **THEN** the adapter SHALL permit the new repayment only with exact snapshots, distinct sources, prior ledger verification, complete conflict coverage, backup, lease and independent readback.

#### Scenario: Unverified or incomplete prior repayment
- **WHEN** any prior snapshot, ledger source, date, amount, account, reciprocity, statement or conflict set disagrees
- **THEN** the adapter SHALL return review without writing.

#### Scenario: Same origin, distinct destinations and same amount
- **WHEN** the operator independently verifies two distinct statement rows within four days, the new recipient report and exact snapshots of the sole conflicting historical reciprocal transfer to a different account
- **THEN** the adapter SHALL permit the separately sourced new transfer while preserving the existing pair, and shall revalidate, back up, audit and independently verify all effects.

#### Scenario: Unidentified same-origin conflict
- **WHEN** snapshots, reciprocal payees, source, date, distinct descriptors or conflict coverage differ, or supporting statement and recipient documents are missing
- **THEN** the adapter SHALL return review without a financial write.

#### Scenario: Distinct nearby interest credits
- **WHEN** each nearby equal-amount income is covered by an exact snapshot and a separately verified ledger source on an independently inspected statement, with a distinct date and reference from the new statement row
- **THEN** preview may propose the new income while retaining all other controls; execution records a pending source reservation before writing and completes it only after independent readback.

#### Scenario: Missing or changed interest evidence
- **WHEN** any reference, identity, date, ledger record, account, category, statement or conflict set is missing, changed or ambiguous
- **THEN** the adapter refuses to write.

#### Scenario: Interrupted or completed interest operation
- **WHEN** the operation is interrupted after recording its intent
- **THEN** all routes reject reuse of its sources until investigation; a completed exact retry verifies its ledger and audit without further writes.

#### Scenario: Verified same-origin prior transfer
- **WHEN** a shared origin statement shows two distinct rows and the only nearby conflict is an exact reciprocal pair to another active account, verified in the cashflow ledger with its distinct source and receipt, and the new recipient statement is independently verified
- **THEN** the adapter SHALL permit the new transfer with lease, backup, audit and independent readback, preserving the prior pair and all sources.

#### Scenario: Invalid verified same-origin evidence
- **WHEN** the ledger, snapshots, sources, dates, destinations, descriptors or conflict coverage disagree
- **THEN** the adapter SHALL return review without writing.

### Requirement: Audited safe commit
The adapter SHALL require the owning lease and lock, back up before writing, synchronize and independently verify all target fields, reciprocal transfer links, balances and unchanged unrelated financial records. A retry SHALL verify an exact prior result without a duplicate and SHALL stop on any partial or conflicting state.

#### Scenario: Verified paired transfer
- **WHEN** a verified transfer is committed
- **THEN** exactly two reciprocal movements appear with equal and opposite values in the verified accounts and no expense category.

#### Scenario: Source already exists
- **WHEN** the exact source is retried
- **THEN** the adapter verifies the existing result and never creates a second movement.

### Requirement: Statement-backed fee expense
The adapter SHALL accept a negative bank charge with an existing non-income category and known payee, a unique line-level bank source, original statement Gmail source and direct evidence. It SHALL apply the same duplicate checks, lease, backup, independent readback and audit as confirmed cashflows.

#### Scenario: Confirmed credit-line fee
- **WHEN** a statement confirms one uniquely identifiable bank interest or tax and the expense category is known
- **THEN** preview proposes one expense and commit independently verifies one corresponding debit.

### Requirement: Verified Drive statement evidence
The system SHALL accept canonical Google Drive file identifiers as cashflow evidence when the operator has verified the statement's account, date and amount, without inventing Gmail sources. The system SHALL retain the actual Drive links and distinct stable bank-row identity through planning, writing, audit and independent readback.

#### Scenario: Cashflow supported only by a Drive statement
- **WHEN** a candidate has no Gmail IDs and has a valid independently verified Drive file identifier
- **THEN** it may be planned under the existing evidence and duplicate rules and the resulting notes and audit preserve the Drive file reference

#### Scenario: Cashflow supported by both Gmail and Drive
- **WHEN** both sources are supplied
- **THEN** each source is preserved as its own canonical link and Gmail-only candidates remain unchanged

#### Scenario: Missing or malformed evidence
- **WHEN** a candidate contains neither a Gmail source nor a valid Drive identifier or contains malformed or repeated identifiers
- **THEN** the system returns review and performs no financial write

#### Scenario: Shared statement describes multiple rows
- **WHEN** multiple transactions cite the same statement
- **THEN** each must have its own stable bank-row source identity and satisfy the existing duplicate checks

### Requirement: Distinguish a different-date statement-backed transfer
The adapter SHALL allow a unique matching destination transfer within the duplicate window only if the candidate explicitly identifies its exact reciprocal origin pair, separate Gmail evidence, and a verified shared destination statement showing distinct credits on different dates. The candidate SHALL also cite an independently verified statement of its own origin, and preserve all evidence and duplicate checks.

#### Scenario: Distinct line draw and later incoming transfer
- **WHEN** both statements verify the new line draw and the identified reciprocal pair is backed by a separate source and a later statement row
- **THEN** plan can propose the new transfer, with backup, revalidation and independent verification as usual.

#### Scenario: Insufficient evidence or additional match
- **WHEN** evidence, dates, accounts, source or reciprocal identities conflict or any other potential duplicate exists
- **THEN** the adapter leaves the candidate in review without writing.

### Requirement: Retain uncategorized confirmed statement expenses for review
The adapter SHALL allow a settled negative expense with verified account, date, amount and statement evidence and an explicit category-pending reason to be recorded without a category. It SHALL return and audit Review status, preserve unique sources and reject uncertain payment, currency or account through existing evidence rules.

#### Scenario: Confirmed uncategorized charge
- **WHEN** a valid statement expense has no category and includes a reason
- **THEN** the adapter previews and records the confirmed charge without category, and marks it for Review with backup and independent verification.

#### Scenario: Missing reason or conflicting category
- **WHEN** an uncategorized charge lacks a reason or an explicit category is invalid
- **THEN** the adapter rejects it without writing.

### Requirement: Distinguish separate same-amount statement purchases
The adapter SHALL allow an otherwise conflicting expense only when a verified statement explicitly contains separate transactions for different merchants and dates with independent receipts; or a verified statement identifies different merchants and dates and a separately inspected receipt identifies the exact single matching legacy transaction; or an operator independently identifies one exact dated, annotated legacy movement without a receipt or payee against a unique matching row in the shared statement and the statement separately identifies another merchant on another date; or separately identified same-merchant rows on different dates have their account, amounts and complete set of matching existing transactions verified against the shared statement; or every matching expense has an exact independently verified ledger entry and a separate merchant row on the same inspected statement, with prior rows allowed to share a date when their merchants differ; or the narrowly evidenced same-day exception in actual-same-day-statement-expenses applies. The candidate SHALL identify the exact existing transaction or transactions and shared statement and preserve all duplicate and provenance checks. Statement identifiers and supplied row descriptions do not themselves prove their contents; an operator MUST independently inspect the statement and applicable receipts.

#### Scenario: Two separately supported purchases
- **WHEN** one matching transaction in the same account has a different merchant and date, the same amount, and a distinct receipt and shared statement
- **THEN** plan may propose a new expense and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Distinct legacy purchase and statement row
- **WHEN** one matching simple unlinked legacy transaction has an exact snapshot, a different merchant and date, an independently verified prior receipt, and a shared statement independently verifies both separate rows
- **THEN** plan may propose the new statement-backed expense and apply preserves the prior transaction, separates its receipt from the new sources and performs backup and independent readback.

#### Scenario: Statement-backed annotated legacy movement without receipt
- **WHEN** an operator independently verifies a unique prior dated statement row and its exact unlinked simple legacy movement with nonempty descriptive notes, together with a separate different-merchant different-date row of equal amount on the same account and statement
- **THEN** the adapter may propose only the new row, including an explicit reason if uncategorized, and apply audits the prior snapshot and evidence with backup and independent readback, without creating or inventing a receipt.

#### Scenario: Multiple same-merchant rows on distinct dates
- **WHEN** the operator has verified distinct dated rows in a statement, and the candidate identifies the shared statement and exact snapshots of all nearby matches on other dates with the same account, payee, category and amount
- **THEN** plan may propose one unique expense, and apply revalidates and audits the exception with backup and independent readback.

#### Scenario: Multiple verified different-merchant statement rows
- **WHEN** every equal-amount nearby matching expense is identified by an exact snapshot and a verified distinct source in the cashflow ledger, and an independently inspected shared statement identifies each separate merchant and date as well as the new row, even if prior rows share a date
- **THEN** the adapter may propose the new purchase, with an explicit Review reason if uncategorized; commit revalidates all evidence, audits the exception, preserves existing entries and verifies a fresh readback.

#### Scenario: Multiple matches or incomplete evidence
- **WHEN** any other matching transaction is not explicitly accounted for, any existing snapshot differs, a prior row shares the new purchase date without the independently verified same-day exception, a source conflicts, or required independently inspected evidence is missing or inconsistent
- **THEN** the adapter leaves the candidate in review without writing.

### Requirement: Create missing evidenced cashflow payees safely
For an otherwise valid, uniquely identified expense or income the adapter SHALL preview whether its exact payee exists or must be created. It SHALL reject ambiguous normalized names or transfer payees, back up and revalidate the complete budget and lease before any creation, and independently verify exactly the intended payee and movement, unchanged unrelated records, and expected balances. A retry with the same stable source SHALL never duplicate the movement, including when a previous attempt created the payee but failed before posting.

#### Scenario: Missing payee and valid expense
- **WHEN** an evidenced expense has no matching payee and no potentially duplicate movement
- **THEN** preview reports payee creation and apply creates exactly one payee and one verified expense.

#### Scenario: Similar or conflicting payee names
- **WHEN** a normalized case or whitespace equivalent payee or a transfer payee conflicts with the proposed exact name
- **THEN** the candidate remains in review and nothing is written.

#### Scenario: Interruption after payee creation
- **WHEN** a previous attempt created the exact payee but did not post the expense
- **THEN** retrying the same source uses the existing payee and never creates a duplicate payee or movement.

#### Scenario: Concurrent budget change
- **WHEN** the budget changes between backup and final pre-write revalidation
- **THEN** the adapter stops before creating the payee or transaction.

### Requirement: Preserve audited legacy line evidence through migration
For an already registered line transfer whose exact legacy matching pair was moved by a completed verified historical account migration, the adapter SHALL preserve the original evidence snapshots unchanged and MAY verify the live pair through the exact old-to-new snapshots recorded in that completed migration audit. This exception SHALL apply only to the same previously registered source and exact original candidate; missing, pending, altered or ambiguous mappings SHALL remain in review.

#### Scenario: Verify previously registered transfer after migration
- **WHEN** a completed migration records exact old and new legacy pair snapshots and the original registered candidate and current pair match those snapshots
- **THEN** a retry SHALL verify the existing transfer without a new write.

#### Scenario: Mismatched or incomplete migration evidence
- **WHEN** the migration is pending, its mapping differs, the current pair changed or another source tries to use the mapping
- **THEN** the adapter SHALL return review without writing.

### Requirement: Verify an owned transfer after a posting-date correction
The adapter SHALL recognize the exact original cashflow candidate only when a single complete posting-date audit links its unchanged original ledger and snapshots to the exact current reciprocal legs. It SHALL independently verify the result without rewriting the original ledger or creating new movements. Pending, absent, altered, ambiguous or unrelated audit chains SHALL remain in review.

#### Scenario: Exact original retry after a complete correction
- **WHEN** the original candidate, unchanged original ledger and verified corrected legs match one complete linked audit
- **THEN** the adapter verifies the existing pair without a financial or ledger write.

#### Scenario: Invalid audit chain
- **WHEN** the original candidate, ledger, audit status, snapshots or corrected legs differ or multiple audits claim the source
- **THEN** the adapter returns review and writes nothing.
