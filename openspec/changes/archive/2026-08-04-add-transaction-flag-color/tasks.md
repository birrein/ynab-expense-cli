## 1. Transactions Capability Baseline

- [x] 1.1 Verify normal transaction listing and configured budget behavior against the new `transactions` baseline scenarios.
- [x] 1.2 Verify normal add dry-run/commit, payload defaults, stable import ids, file input, and split creation against the baseline scenarios.
- [x] 1.3 Verify simple edit and safe split replacement behavior against the baseline scenarios without changing established behavior.

## 2. Domain Payloads

- [x] 2.1 Add optional flag-color input to normal transaction creation and include `flag_color` only when explicitly supplied.
- [x] 2.2 Preserve the existing normal transaction edit patch behavior while adding explicit `flag_color` support.
- [x] 2.3 Preserve scheduled transaction flag colors during read-before-write merges and apply an explicit replacement when `--flag-color` is supplied.

## 3. CLI Surface

- [x] 3.1 Expose `--flag-color` on `add`, `edit`, `scheduled add`, and `scheduled edit` with consistent help text.
- [x] 3.2 Keep omitted flag colors absent from create payloads and preserve existing scheduled colors when editing without the option.
- [x] 3.3 Keep dry-run/commit mutual exclusion and ensure flag-only edits still require an explicit `--commit` to write.

## 4. Tests And Documentation

- [x] 4.1 Add unit and CLI coverage for normal add/edit and scheduled add/edit flag payloads, omission, preservation, and commit behavior.
- [x] 4.2 Update README command examples and supported-field lists for `--flag-color`.
- [x] 4.3 Run `go test ./...`, `go vet ./...`, `git diff --check`, and representative dry-runs for all four command paths.

## 5. Existing Installment Migration

- [x] 5.1 Run targeted dry-runs for existing installment series that need the `cuotas` flag, including normal and scheduled rows.
- [x] 5.2 Commit only approved targeted edits, reread YNAB, and verify `flag_name: "cuotas"` and `flag_color: "purple"` for every row.
