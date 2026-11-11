## Context

Existing note operations require a source ledger; historical purchases may lack one. A receipt and statement can establish the correction without fabricating an imported source.

## Goals / Non-Goals

**Goals:** Replace one literal fragment of an exact historical note with independently evidenced text, without changing any other transaction or balance.

**Non-Goals:** Alter or add links, tags, ledger sources, categories, dates or amounts; support transfers, splits, scheduled or reconciled transactions.

## Decisions

Require the full exact transaction snapshot, distinct Drive IDs for the statement and provider receipt, evidence, and one unique literal old/new fragment. Forbid URLs, hashtags, source metadata and line breaks in notes or replacement text in this initial narrow mode. A generic free-form note rewrite would be less constrained. The operator must verify both documents; IDs do not prove their contents. Use lease, backup, sync, full budget comparison and independent readback with an exact candidate audit; reject unaudited altered states.

## Risks / Trade-offs

The operation cannot repair notes containing provenance or tags → leave those for a dedicated supported workflow. A concurrent update can occur after revalidation → fail closed on full readback and preserve the backup.
