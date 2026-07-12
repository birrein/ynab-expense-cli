## 1. Scheduled Models And Client

- [x] 1.1 Add scheduled transaction request/response model types with `scheduled_transaction` wrappers, list response parsing/filtering helpers, frequency allowlist validation, and mapper helpers for create/edit payloads.
- [x] 1.2 Add scheduled date validation helpers that parse `YYYY-MM-DD`, reject non-future dates, reject dates more than five years out, and can be tested with a pinned current date.
- [x] 1.3 Extend the YNAB client interface and implementation with `GetScheduledTransactions`, `GetScheduledTransaction`, `CreateScheduledTransaction`, and `UpdateScheduledTransaction`.
- [x] 1.4 Add YNAB client tests for scheduled list GET, single GET, POST, PUT, path escaping, content-type headers, and readable API error reuse.

## 2. Scheduled List CLI

- [x] 2.1 Add a `scheduled` parent command that obtains scheduled transactions by default without changing normal `transactions`, `add`, or `edit` behavior.
- [x] 2.2 Implement `scheduled` flag parsing, budget default resolution, `--since`/`--until` date validation, and token-required YNAB access.
- [x] 2.3 Implement local `date_next` filtering for `--since`/`--until` while preserving raw YNAB output when no filters are supplied.
- [x] 2.4 Add CLI tests for unfiltered scheduled retrieval, configured default budget, inclusive `date_next` filtering, invalid filter dates, and missing token behavior.

## 3. Scheduled Add CLI

- [x] 3.1 Register `scheduled add` under the `scheduled` command group.
- [x] 3.2 Implement `scheduled add` flag parsing, budget/account default resolution, required-field validation, amount parsing, memo audit marker handling, and default `frequency: "never"`.
- [x] 3.3 Implement `scheduled add` dry-run output that does not require token resolution and prints the exact payload that would be sent.
- [x] 3.4 Implement `scheduled add --commit` to call `CreateScheduledTransaction` and print the raw YNAB response.
- [x] 3.5 Add CLI tests for dry-run, configured defaults, explicit defaults override, commit, missing required fields, invalid dates, unsupported frequencies, `--dry-run` plus `--commit`, and rejected `--file`.

## 4. Scheduled Edit CLI

- [x] 4.1 Register `scheduled edit` under the `scheduled` command group.
- [x] 4.2 Implement `scheduled edit` flag parsing and validation for `--id`, changed-field detection, `--currency` requiring `--amount`, dates, frequencies, and `--dry-run` plus `--commit`.
- [x] 4.3 Implement scheduled edit read-before-write behavior using `GetScheduledTransaction`, including fetched-id mismatch checks and split scheduled transaction rejection.
- [x] 4.4 Implement full PUT payload merge logic that preserves unchanged fields, maps `date_next` to save-model `date`, preserves `payee_id` unless `--payee` is supplied, and parses edited amounts as expenses.
- [x] 4.5 Implement scheduled edit dry-run output with `before` and full update `payload`.
- [x] 4.6 Implement scheduled edit `--commit` using `UpdateScheduledTransaction` and raw response output.
- [x] 4.7 Add CLI tests for dry-run token requirement, preview output, commit payload, unchanged field preservation, payee-name replacement, amount parsing, date validation, mismatched fetched id, split rejection, no edit fields, and `--dry-run` plus `--commit`.

## 5. Documentation And Verification

- [x] 5.1 Update README usage docs with `scheduled`, `scheduled add`, `scheduled edit`, frequency values, date filter behavior, safety notes, and scope exclusions for splits/files/delete.
- [x] 5.2 Run `go test ./...` and fix any failures.
- [x] 5.3 Run `go build -o ynab-expense ./cmd/ynab-expense` and verify the binary builds.
- [x] 5.4 Run representative local dry-run/read commands for `scheduled`, `scheduled add`, and `scheduled edit` using fake/testable paths where possible, or document why a live edit dry-run was not run.

Verification note: live `scheduled` reads and `scheduled edit` dry-runs require a configured token and existing YNAB scheduled transaction, so coverage uses fake-client tests. Local no-token checks were run for `scheduled add --dry-run`, `scheduled --since not-a-date`, and `scheduled edit --id scheduled-1 --date not-a-date`.
