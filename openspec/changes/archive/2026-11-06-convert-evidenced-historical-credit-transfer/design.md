## Context
An existing uncategorized historical positive credit has no source, payee or transfer link. A sender receipt and destination statement independently identify an own-account transfer. An isolated official API test confirmed setting its payee to the origin transfer payee creates exactly one opposite leg and preserves the original ID.

## Goals / Non-Goals
Convert only historical unreconciled unscheduled simple credits without imported source, category or ledger ownership. Do not modify existing other transactions or permit vague candidate matches. Never claim document IDs prove their contents.

## Decisions
Use a separate operation with exact full prior transaction snapshot, independently inspected Gmail receipt ID and destination statement ID, distinct active accounts, exact positive date and amount, and new notes including the canonical evidence links. Reject any matching negative origin within four days. Save candidate and whole snapshot in a backup, revalidate live state, record a pending audit before calling the official API, then verify a fresh independent snapshot, transfer payees, links, values, exact expected notes, every other transaction and all balances. Store complete audit only after verification; a pending audit fails closed. The design avoids creating then deleting a duplicate and retains the historical ID. Unrelated history and metadata are untouched.

## Risks / Trade-offs
A bank date and amount do not prove identity alone; operator review and exact independent receipts are mandatory. A crash after writing requires manual audit and backup investigation; never retry a pending audit automatically.
