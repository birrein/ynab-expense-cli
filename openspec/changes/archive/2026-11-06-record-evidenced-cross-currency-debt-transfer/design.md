## Context
The budgets use distinct sync IDs and native transfers cannot connect across them. Historical transfers use transfer-exclusion categories and shared references; dashboard exclusions do not cover all possible reports. The operator must inspect both statement sections.

## Goals / Non-Goals
**Goals:** One directed pair using exact independently supported amounts, audited and verified in both budgets.
**Non-Goals:** Inferring or converting currency, creating categories/accounts, background matching, globally changing reports, or altering unrelated data.

## Decisions
One adapter command under the existing lease and lock downloads and backs up both budgets sequentially, saves pending audit before writing, and writes one categorized row per budget through the official API. It independently reloads each budget and compares all original state plus the exact new entry and balance change. Completed retries verify the exact sourced entries; pending or unexplained source states require investigation. A pair uses the existing CLP Salida CLP and USD Transferencias entre monedas / Entrada USD categories already excluded from configured dashboards. The pair is not a native linked transfer, so notes and audit retain a shared explicit reference and bank statement link. Alternative guessed rate or ordinary income/expense categories are rejected.

## Risks / Trade-offs
A cross-budget transaction cannot be atomic: pending audit, two backups, conservative retry and explicit incident recovery avoid blind duplication. Filters protect configured widgets but not every report; document that limitation. No write until API and failure tests pass.
