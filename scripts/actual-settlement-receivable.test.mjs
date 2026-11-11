import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySettlementReceivable, settlementReceivable } from './actual-settlement-receivable.mjs';

const candidate = {
  settlementReceivableOpening: true, currency: 'CLP', name: 'Liquidación por cobrar Example',
  date: '2026-05-18', bankDate: '2026-05-18', amount: 4292800,
  sourceId: 'checkpoint:settlement:example:20260518', settlementFileId: 'settlement12345',
  bankStatementFileId: 'bankstatement12345', confirmationMessageId: 'abcdef1234567890',
  evidence: 'The vendor document and bank statement identify the same person, amount and settlement.',
  reportingEvidence: 'The income widget excludes the Starting Balances category and other reports need review.',
  limitations: 'This is only the net receivable checkpoint; historical cost, promotion and other assets remain unresolved.',
};
const base = () => ({
  accounts: [{ id: 'old', name: 'Bank', closed: false, offbudget: false }],
  payees: [{ id: 'start', name: 'Starting Balance' }, { id: 'oldpayee', name: 'Bank', transfer_acct: 'old' }],
  categories: [{ id: 'openingcat', name: 'Starting Balances', is_income: true, hidden: false }],
  transactions: [], balances: { old: 0 }, rules: [], schedules: [],
});
const clone = x => structuredClone(x);

test('only a uniquely named, source-backed and reporting-aware receivable is previewed', () => {
  const s = base();
  const result = classifySettlementReceivable(candidate, s, {});
  assert.equal(result.action, 'create');
  assert.match(result.notes, /por cobrar/i);
  for (const bad of [
    { name: 'Cash' }, { amount: 0 }, { date: '2026-02-30' },
    { bankDate: '2026-05-17' }, { bankDate: '2026-06-01' },
    { settlementFileId: 'bad' }, { bankStatementFileId: candidate.settlementFileId },
    { confirmationMessageId: 'bad-id' }, { sourceId: '' }, { evidence: '' },
    { reportingEvidence: '' }, { limitations: '' }, { surprise: true },
  ]) assert.throws(() => classifySettlementReceivable({ ...candidate, ...bad }, s, {}));
  assert.throws(() => classifySettlementReceivable(candidate, { ...s, accounts: [...s.accounts, { id: 'x', name: candidate.name.toUpperCase() }] }, {}), /account/i);
  assert.throws(() => classifySettlementReceivable(candidate, s, { settlementReceivables: { [candidate.sourceId]: { status: 'pending', candidate } } }), /pending/i);
  assert.throws(() => classifySettlementReceivable(candidate, s, { settlementReceivables: { other: { candidate } } }), /source|document|settlement/i);
});

function harness() {
  let snapshot = base(), ledger = {}, creates = 0;
  const api = {
    async sync() {}, async shutdown() {},
    async createAccount(a, amount) {
      creates++; snapshot.accounts.push({ id: 'new', name: a.name, closed: false, offbudget: false });
      snapshot.payees.push({ id: 'newpayee', name: a.name, transfer_acct: 'new' });
      snapshot.transactions.push({ id: 'opening', account: 'new', date: '2026-11-07', amount,
        payee: 'start', category: 'openingcat', notes: null, starting_balance_flag: true,
        is_parent: false, is_child: false, transfer_id: null, cleared: true });
      snapshot.balances.new = amount; return 'new';
    },
    async updateTransaction(id, patch) { Object.assign(snapshot.transactions.find(t => t.id === id), patch); },
  };
  const d = {
    async connect() { return { api }; }, async snapshot() { return clone(snapshot); },
    async readState() { return clone(ledger); }, async requireRun() { return clone(ledger); },
    async save(value) { ledger = clone(value); }, async backup() { return '/backup'; }, async json() {},
  };
  return { d, get: () => ({ snapshot, ledger, creates }) };
}

test('independently verifies a receivable and an exact retry makes no second account', async () => {
  const h = harness();
  const plan = await settlementReceivable(candidate, false, h.d);
  assert.equal(plan.action, 'create'); assert.match(plan.reporting, /Starting Balances/);
  const result = await settlementReceivable(candidate, true, h.d);
  assert.equal(result.verified, true);
  const { snapshot, ledger } = h.get();
  assert.equal(snapshot.transactions[0].date, candidate.date);
  assert.equal(snapshot.transactions[0].starting_balance_flag, true);
  assert.match(snapshot.transactions[0].notes, /settlement12345/);
  assert.match(snapshot.transactions[0].notes, /bankstatement12345/);
  assert.equal(ledger.settlementReceivables[candidate.sourceId].status, 'complete');
  assert.equal((await settlementReceivable(candidate, true, h.d)).action, 'existing');
  assert.equal(h.get().creates, 1);
});

test('an interrupted write leaves a pending audit and cannot recreate the account', async () => {
  const h = harness(), original = h.d.connect;
  h.d.connect = async (...args) => { const x = await original(...args); x.api.updateTransaction = async () => { throw new Error('interrupted'); }; return x; };
  await assert.rejects(settlementReceivable(candidate, true, h.d), /interrupted/);
  assert.equal(h.get().ledger.settlementReceivables[candidate.sourceId].status, 'pending');
  await assert.rejects(settlementReceivable(candidate, true, h.d), /pending/i);
  assert.equal(h.get().creates, 1);
});

test('an unrelated change during backup stops creation before writing', async () => {
  const h = harness();
  h.d.backup = async () => { h.get().snapshot.accounts[0].name = 'Changed elsewhere'; return '/backup'; };
  await assert.rejects(settlementReceivable(candidate, true, h.d), /Budget changed/);
  assert.equal(h.get().creates, 0);
  assert.equal(h.get().ledger.settlementReceivables, undefined);
});

test('a changed audited receivable cannot be silently accepted on retry', async () => {
  const h = harness(); await settlementReceivable(candidate, true, h.d);
  h.get().snapshot.transactions[0].amount++;
  await assert.rejects(settlementReceivable(candidate, true, h.d), /opening differs/i);
  assert.equal(h.get().creates, 1);
});

test('commit requires the owning run before creating an account', async () => {
  const h = harness();
  h.d.requireRun = async () => { throw new Error('Run lease missing or owned by another execution'); };
  await assert.rejects(settlementReceivable(candidate, true, h.d), /lease/);
  assert.equal(h.get().creates, 0);
});
