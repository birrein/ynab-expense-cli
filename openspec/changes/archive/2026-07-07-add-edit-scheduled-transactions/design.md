## Context

`ynab-expense` currently creates normal transactions through `POST /plans/{plan_id}/transactions` and edits normal transactions through `PATCH /plans/{plan_id}/transactions`. That path rejects future-dated transactions, which makes it unusable for planned card installments and other future expenses.

YNAB exposes scheduled transactions as a separate resource. The official SDK model uses:

- `GET /plans/{plan_id}/scheduled_transactions` for listing scheduled transactions.
- `POST /plans/{plan_id}/scheduled_transactions` with a `scheduled_transaction` wrapper for create.
- `GET /plans/{plan_id}/scheduled_transactions/{scheduled_transaction_id}` for reading the current scheduled transaction.
- `PUT /plans/{plan_id}/scheduled_transactions/{scheduled_transaction_id}` with a `scheduled_transaction` wrapper for update.

The CLI should preserve the existing local safety model: previews before writes, explicit `--commit`, and raw YNAB response output after successful commits.

## Goals / Non-Goals

**Goals:**
- Add `ynab-expense scheduled` for obtaining scheduled transactions with familiar date filter flags.
- Add `ynab-expense scheduled add` for creating single-category scheduled expense transactions.
- Add `ynab-expense scheduled edit` for editing existing scheduled expense transactions.
- Reuse existing budget/account default resolution, CLP/USD amount parsing, JSON output style, and memo audit marker behavior.
- Validate scheduled dates and frequencies locally before calling YNAB.
- Keep scheduled transaction writes on the scheduled transaction endpoints.

**Non-Goals:**
- Do not make normal `add` or `edit` switch endpoints based on future dates.
- Do not implement scheduled transaction `list` or `delete` in this change.
- Do not implement `--file` input or installment-plan expansion in this change.
- Do not create or edit scheduled split transactions.
- Do not add payee/category lookup by name beyond the existing `payee_name` behavior.
- Do not support inflow-oriented scheduled transactions in this change.

## Decisions

### Use `scheduled` as the scheduled transaction noun command

Add a parent command that lists scheduled transactions by default and also owns write subcommands:

```sh
ynab-expense scheduled
ynab-expense scheduled --since 2026-08-01 --until 2026-08-31
ynab-expense scheduled add
ynab-expense scheduled edit
```

This follows the existing noun-style convention where `ynab-expense transactions --since ... --until ...` lists regular transactions. It avoids a new `list` verb while keeping scheduled transaction writes grouped under the same noun.

Alternative considered: `ynab-expense scheduled list`. That is explicit, but it diverges from the current regular transaction command surface where listing is the noun command itself.

### List uses YNAB scheduled retrieval plus local date filtering

The scheduled list endpoint accepts YNAB's scheduled transaction retrieval parameters rather than the regular transaction endpoint's `since_date` and `until_date` filters. To preserve CLI convention, `ynab-expense scheduled` should accept:

- `--budget`
- `--since`
- `--until`

The command should fetch scheduled transactions with `GET /plans/{plan_id}/scheduled_transactions` and apply `--since`/`--until` locally against each scheduled transaction's `date_next`. If no date filters are supplied, print the raw YNAB response body. If filters are supplied, print JSON in the same response shape with only matching scheduled transactions and preserve any response metadata that can be carried forward without fabrication.

The filtering is intentionally based on `date_next`, because that is the next actionable date for both one-off and recurring scheduled transactions.

### Create uses local payload construction and dry-run without token

`scheduled add` should behave like normal `add`: build the payload locally, print a dry-run JSON preview by default, and only resolve a token on `--commit`.

The command supports:

- `--budget`
- `--account-id`
- `--amount`
- `--currency`
- `--payee`
- `--date`
- `--category-id`
- `--memo`
- `--frequency`
- `--dry-run`
- `--commit`

`--frequency` defaults to `never`. Positive user-facing amounts are parsed with the existing money package and sent as negative YNAB milliunits.

### Edit reads first and merges into a full PUT payload

YNAB scheduled transaction update uses `PUT`, not the existing normal-transaction batch `PATCH`. Therefore `scheduled edit` should:

1. Resolve the budget.
2. Fetch the current scheduled transaction with `GET`.
3. Validate the fetched id matches `--id`.
4. Build a full save payload by merging changed flags over the fetched scheduled transaction.
5. Print `before` and the final `payload` in dry-run.
6. Send the same final payload with `PUT` only when `--commit` is present.

Dry-runs require a token because the command must read from YNAB before previewing the update.

When carrying forward fields from the GET response:

- Use `date_next` as the save-model `date` unless `--date` is supplied.
- Use existing `amount`, `account_id`, `category_id`, `memo`, and `frequency` unless changed.
- Preserve `payee_id` when the payee is not changed.
- When `--payee` is supplied, send `payee_name` and omit `payee_id` so YNAB resolves the named payee.

### Keep scheduled models separate from normal transactions

Add a small scheduled transaction model package or file rather than stretching `transactions.Transaction`. Scheduled transactions have different wrapper names, list response shapes, update semantics, response fields (`date_first`, `date_next`), and no `import_id`, `cleared`, or `approved` fields in the save model.

The existing `transactions.AuditMemo` helper can be reused for the memo marker rather than duplicating marker logic.

### Validate dates using the local calendar date

The CLI accepts date-only ISO values. Validation should compare against the user's local calendar date, consistent with the reconciliation workflow and YNAB's date-only API examples.

Implementation should keep this testable by using a small date helper or injectable clock in CLI tests. The command rejects dates that are today or in the past, dates more than five years in the future, and malformed dates.

### Frequency is an explicit allowlist

The CLI should accept only the scheduled transaction frequencies exposed by the YNAB SDK:

```text
never
daily
weekly
everyOtherWeek
twiceAMonth
every4Weeks
monthly
everyOtherMonth
every3Months
every4Months
twiceAYear
yearly
everyOtherYear
```

This keeps typos from reaching the API and makes `never` reliable for one-off installment use cases.

## Risks / Trade-offs

- API field mismatch between GET detail and PUT save model -> Use an explicit mapper and tests that prove `date_next` becomes `date` and unsupported response-only fields are not resent.
- List date filters are local rather than server-side -> Document that `--since`/`--until` filter `date_next`, and test that unfiltered output remains raw while filtered output preserves the expected response shape.
- Editing by full PUT can accidentally change unchanged fields if merge logic is wrong -> Dry-run prints both `before` and final payload; tests cover unchanged-field preservation.
- Local date validation can be brittle in tests -> Isolate the current-date calculation so tests can pin dates.
- Scheduled split transactions may appear in GET responses even though create is unsupported -> Reject edit when the fetched scheduled transaction contains split subtransactions unless the edit is read-only preview of the rejection.
- `--file` and installment helpers would be convenient but broaden scope -> Keep this change focused on primitive create/edit commands; add higher-level batch creation later.
