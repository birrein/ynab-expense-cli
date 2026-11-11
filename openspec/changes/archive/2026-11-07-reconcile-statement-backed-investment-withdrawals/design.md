## Context

The official Actual API creates an opening-balance transaction on the current date. Investment statements can establish a cash balance at a past checkpoint, but the adapter only supports creating a zero-balance credit line. Existing cashflow operations create and verify native transfers between active on-budget accounts.

## Goals / Non-Goals

**Goals:** Create an investment cash account with a statement-backed historical starting balance and reuse the existing native-transfer operation to record confirmed bank withdrawals. The account is a checkpoint, not complete prior investment history.

**Non-Goals:** Reconstruct asset acquisition costs, assume past investment returns, calculate exchange rates, backdate other movements, or alter the actual bank accounts. Do not create a cross-budget transfer in this change.

## Decisions

- Require a unique account name, currency, historical checkpoint date, integer opening amount, statement ID, evidence explaining the checkpoint and its limits, and stable audit key. The operator independently reads the statement and verifies that the precise amount and timing are supported; assertions in the candidate do not prove a statement.
- Create an on-budget account with the native starting-balance mechanism, then update the generated opening transaction's date and provenance. Starting balance is an explicit checkpoint and must retain `starting_balance_flag`, rather than an ordinary income transaction. Verify its reporting behavior and category before applying real data.
- Save the before snapshot and durable `pending` audit before the first mutation; keep lock and lease. A partially completed or conflicting audit is an explicit recovery case, never automatically retry creation. A complete exact audit permits readback-only retry.
- Check the new account, transfer payee and exactly one dated starting transaction independently after synchronization; check all other budget records and balances remain unchanged.
- Register withdrawals separately with the existing cashflow transfer workflow after the new account is verified. A failure to create the withdrawal does not justify repeating account creation. Both source and destination documents and recipient identity are required.

## Risks / Trade-offs

- [Checkpoint precedes incomplete history] → Label the account and record the date and source; do not claim that earlier investment history has been reconstructed.
- [Starting balance is classified as income by reports] → Verify the native flag and existing reporting behavior before applying; do not post if reporting cannot distinguish it from earned income.
- [Interruption after account creation] → Preserve a pending audit and backup; do not silently resume or create a second account.
- [External app changes while applying] → Revalidate snapshot and use existing lock; independently download and compare all unrelated data.
