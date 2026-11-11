## Context
The adapter supports verified cashflows only if at least one Gmail ID is present. Bank PDFs obtained from the bank and independently verified in Drive can be the only evidence of a deposit.

## Goals / Non-Goals
Accept real Drive evidence without inventing Gmail links; keep existing candidates, source IDs, duplicate protections and financial verification unchanged. Not an automated bank importer or account-consolidation mechanism.

## Decisions
Add optional `driveFileIds`, a list of opaque Google Drive file IDs. `sourceIds` remains a list of actual Gmail message IDs and can be empty only if at least one valid Drive file ID is supplied. Render canonical Drive URLs after Gmail links and before the stable source marker; preserve both lists in the audit. Require the operator to verify the named PDF in Drive for bank, account, date and amount before plan. Validate type, nonempty IDs, allowed identifier syntax, uniqueness, and prohibit arbitrary URLs. Retain stable `bank:` sourceId and the existing account/amount/date duplicate check. For transfers, require separate corroboration of the destination account as today. Existing Gmail-only notes and idempotent readback stay byte-for-byte compatible.

## Risks / Trade-offs
The adapter does not authenticate PDF content; human evidence review and a remote fetch are mandatory. A Drive file can contain multiple movements, so the imported ID identifies the actual bank row, not just the PDF. Repeat same candidate after partial failure and inspect the source before any retry.

## Verification
Test Drive-only, mixed evidence, missing/malformed/duplicate references, idempotency and existing Gmail candidate compatibility; run adapter and CLI suites. Verify a local isolated create/readback before live plan and apply.
