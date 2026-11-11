# Actual daily automation implementation ledger

Plan: approved in conversation on 2026-10-11; no separate specification file.

- Existing untracked historical scripts preserved. New work on `feat/actual-daily-automation`; no unrelated files staged or committed.
- Ruling: use a branch in the current checkout instead of a separate worktree because the operational API/scripts are untracked and tied to this checkout; no existing scripts modified.
- LaunchAgent installed and HTTP 200 verified. Uses existing Node 22.20.0/data directories; no credential in plist.
- Policy tests: missing implementation failed first, then seven tests passed. Includes source deduplication, uncertain same-amount transactions, pending category, split totals, readback, independent windows.
- Daily records and backups live outside Git in `/Users/birrein/Actual-pilot/daily`, not Codex memories.
- Integration finding: Actual 26.8.1 addTransactions returns `ok`, not IDs. Two real charges were created once; source-based fresh downloads found them. Fixed ID extraction with regression test; retries must verify existing source IDs, never recreate the charges.
- Added regression test for nearby bank/receipt dates: failed with create instead of review, then passed with conservative three-day amount/account collision protection.
- Final review: self-review; no subagent tool available. Checked lease ownership, exception paths, duplicate/source handling, category resolution, backup and independent readback. No changes to historical scripts or YNAB CLI behavior.
- Verification: all15 Node tests passed, including10 new daily adapter/policy tests; go test ./... passed. git diff --check passed. No staging or commits performed.
- LaunchAgent recovery test: SIGTERM followed by a new running PID and HTTP200; full logout/login not exercised. One server listener confirmed.
- Four budgets renamed with ZIP backups and unchanged financial snapshots. Final independent download confirms20,542CLP and1,298USD; all original transactions unchanged, only six CLP expenses totaling90,121 and two USD totaling35.79 added. Account/category/rule/schedule invariants and balance deltas verified.
- First real execution: daily10/10 and historical08–14/08 completed; lease closed, independent checkpoints persisted. Three new transactions pending category, no speculative categories or adjustments. Actual labels verified:8 Registered,14 Review (including legacy cases),39 Ignore.
- Vault hub and August/October notes updated with source links and transaction IDs. Existing daily automation updated through app tool and activated for08:00 America/Santiago; historical heartbeat remains paused. Scheduled dispatch itself has not yet occurred.
- Remaining operational limits: local Mac/session/Codex availability; token recovery if authentication changes; temporary API client directories have no automatic retention policy; no remote HTTPS or sleep changes. This implementation does not certify bank balances or complete the August–October catch-up.
