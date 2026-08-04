## Context

The CLI already supports normal and scheduled YNAB expenses, with dry-run previews and explicit commits. Scheduled transactions were introduced through OpenSpec, but normal transaction listing, creation, editing, and split replacement predate the project's OpenSpec adoption and have no canonical capability spec. Installment workflows also use a YNAB flag named `cuotas`, represented by the `purple` flag color in the user's budget, but the CLI previously exposed no consistent option for writing that field.

## Goals / Non-Goals

**Goals:**

- Establish a concise `transactions` capability baseline for the stable public behavior that already exists.
- Expose one `--flag-color` option on normal `add`/`edit` and scheduled `add`/`edit`.
- Include the optional `flag_color` field in the corresponding YNAB payloads.
- Preserve an existing scheduled flag when editing another field.
- Keep omitted flags omitted and preserve the existing dry-run/commit safety model.
- Make the behavior testable and documented.

**Non-Goals:**

- Document every internal Go type, helper, validation branch, or exact error string in the baseline spec.
- Rename or manage YNAB flag names through the CLI; the CLI writes colors and YNAB resolves the display name.
- Automatically migrate every existing transaction in a budget.
- Change installment dates, amounts, categories, memos, or import-id generation.
- Add split-transaction flag editing beyond the existing normal split replacement boundaries.

## Decisions

### Baseline the public contract, not the implementation

The new `transactions` capability covers the stable user-visible behavior of `transactions`, `add`, and `edit`: date-filtered listing, preview-first creation, explicit commits, deterministic transaction payload defaults, simple/split creation, read-before-write editing, and safe split replacement. Internal package boundaries and incidental implementation details remain outside the spec.

Alternative rejected: keep a narrow `transaction-flags` capability. That would describe the immediate field addition accurately, but it would fragment future normal-transaction requirements and leave the central existing capability undocumented.

Alternative rejected: inventory every existing test and validation branch. That would turn the baseline into a brittle code mirror rather than a durable behavioral contract.

### Use YNAB's existing `flag_color` field

Normal transactions will send `flag_color` in the partial PATCH payload, while scheduled transactions will include it in the existing save model used by POST and full PUT. This avoids a new endpoint or a separate tagging abstraction and matches the field already returned by YNAB as `flag_color`/`flag_name`.

Alternative rejected: encode `cuotas` only in the memo. Memo text remains useful for `1/N` numbering, but it does not provide the visual/filterable YNAB flag requested by the reconciliation workflow.

### Keep the option optional and additive

When `--flag-color` is omitted, the payload must preserve current behavior. For scheduled edits, the fetched color is retained unless the option is explicitly supplied. For normal edits, the PATCH includes the color only when explicitly supplied.

Alternative rejected: assign purple automatically to every expense. That would incorrectly mark non-installment purchases and make unrelated existing transactions harder to classify.

### Apply the same CLI spelling across command families

The option is named `--flag-color` for `add`, `edit`, `scheduled add`, and `scheduled edit`. The installment workflow uses `--flag-color purple`, which YNAB displays as the `cuotas` flag in this budget.

## Risks / Trade-offs

- [Risk] A color accepted by the CLI may not be accepted by YNAB. → Mitigation: document the supported YNAB colors, rely on YNAB API errors for invalid values, and verify the read-back `flag_name`/`flag_color` after writes.
- [Risk] A full scheduled PUT could accidentally clear unrelated fields. → Mitigation: retain the existing read-before-write merge path and add regression coverage for unchanged fields and flag preservation.
- [Risk] Existing installment rows remain untagged until explicitly migrated. → Mitigation: keep migration out of automatic behavior and use targeted dry-run/commit edits for known series.

## Migration Plan

1. Verify the existing normal transaction implementation and tests against the new baseline requirements without changing established behavior.
2. Add the optional flag field to normal and scheduled command payload builders.
3. Add CLI and model tests plus README examples.
4. For already-created installment series, run targeted `edit`/`scheduled edit` dry-runs, then commit only the intended rows.
5. Re-read YNAB and confirm `flag_name: "cuotas"` before marking related Gmail evidence registered.

Rollback is a targeted edit that removes or changes the flag on affected rows; no schema or database migration is required.

## Open Questions

None for this change. Named YNAB tag management remains outside scope; the workflow intentionally uses the stable color-to-tag mapping already present in the budget.
