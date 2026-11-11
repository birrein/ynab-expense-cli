import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInvestmentOpening, investmentOpening } from './actual-investment-opening.mjs';

const candidate = {
  statementInvestmentOpening: true, currency: 'CLP', name: 'Investment checkpoint',
  date: '2026-07-08', amount: 25667700,
  sourceId: 'checkpoint:investment:20260708:clp', statementFileId: 'statement123456',
  evidence: 'Statement shows this post-sale cash checkpoint; earlier history is not reconstructed.',
};
const base = () => ({
  accounts: [{ id: 'old', name: 'Bank', closed: false, offbudget: false }],
  payees: [{ id: 'start', name: 'Starting Balance' }, { id: 'oldpayee', name: 'Bank', transfer_acct: 'old' }],
  categories: [{ id: 'openingcat', name: 'Starting Balances', is_income: true, hidden: false }],
  transactions: [], balances: { old: 0 }, rules: [], schedules: [],
});
const clone = x => structuredClone(x);

test('requires a valid uniquely named statement checkpoint and rejects collisions', () => {
  const s = base();
  assert.equal(classifyInvestmentOpening(candidate, s, {}).action, 'create');
  for (const bad of [
    { amount: 0 }, { date: '2026-02-30' }, { statementFileId: 'bad' },
    { sourceId: '' }, { evidence: '' }, { surprise: true },
  ]) assert.throws(() => classifyInvestmentOpening({ ...candidate, ...bad }, s, {}));
  assert.throws(() => classifyInvestmentOpening(candidate, { ...s, accounts: [...s.accounts, { id: 'x', name: candidate.name.toUpperCase() }] }, {}), /account/i);
  assert.throws(() => classifyInvestmentOpening(candidate, { ...s, categories: [] }, {}), /Starting Balances/);
  assert.throws(() => classifyInvestmentOpening(candidate, s, { investmentOpenings: { [candidate.sourceId]: { status: 'pending', candidate } } }), /pending/i);
});

function harness() {
  let snapshot = base(); let ledger = {}; let creates = 0; const files = {};
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
    async save(value) { ledger = clone(value); }, async backup() { return '/backup'; },
    async json(path, value) { files[path] = clone(value); },
  };
  return { d, get: () => ({ snapshot, ledger, creates, files }) };
}

test('creates and independently verifies a dated native opening, then exact retry is read-only', async () => {
  const h = harness();
  const plan = await investmentOpening(candidate, false, h.d);
  assert.equal(plan.action, 'create'); assert.match(plan.reporting, /exclude/i);
  const result = await investmentOpening(candidate, true, h.d);
  assert.equal(result.verified, true); assert.equal(result.id, 'new');
  const { snapshot, ledger } = h.get();
  assert.equal(snapshot.transactions[0].date, candidate.date);
  assert.equal(snapshot.transactions[0].starting_balance_flag, true);
  assert.match(snapshot.transactions[0].notes, /statement123456/);
  assert.equal(ledger.investmentOpenings[candidate.sourceId].status, 'complete');
  assert.equal((await investmentOpening(candidate, true, h.d)).action, 'existing');
  assert.equal(h.get().creates, 1);
});

test('an interrupted account write leaves pending audit and blocks retries', async () => {
  const h = harness(); const originalConnect = h.d.connect;
  h.d.connect = async (...args) => { const x = await originalConnect(...args); x.api.updateTransaction = async () => { throw new Error('interrupted'); }; return x; };
  await assert.rejects(investmentOpening(candidate, true, h.d), /interrupted/);
  assert.equal(h.get().ledger.investmentOpenings[candidate.sourceId].status, 'pending');
  await assert.rejects(investmentOpening(candidate, true, h.d), /pending/i);
  assert.equal(h.get().creates, 1);
});

test('stops before writing if an unrelated account changes after backup', async () => {
  const h = harness();
  h.d.backup = async () => { h.get().snapshot.accounts[0].name = 'Changed elsewhere'; return '/backup'; };
  await assert.rejects(investmentOpening(candidate, true, h.d), /Budget changed/);
  assert.equal(h.get().creates, 0);
  assert.equal(h.get().ledger.investmentOpenings, undefined);
});

test('a changed audited starting balance cannot be silently accepted on retry', async () => {
  const h = harness(); await investmentOpening(candidate, true, h.d);
  h.get().snapshot.transactions[0].amount++;
  await assert.rejects(investmentOpening(candidate, true, h.d), /opening differs/i);
  assert.equal(h.get().creates, 1);
});
