import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as actual from './actual-runtime/node_modules/@actual-app/api/dist/index.js';

async function subject() {
  try { return await import('./actual-card-refinancing.mjs'); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') assert.fail('Refinancing validation is not implemented');
    throw error;
  }
}

const candidate = () => ({
  cardRefinancing: true, currency: 'CLP', cardAccount: 'card', debtAccountName: 'Debt test',
  openingDate: '2026-01-03', principal: 10_000_000, rateBps: 100,
  interestCategory: 'fees', payeeId: 'bank', contractSourceId: 'abcd1234', sourceKey: 'bank:test:refinance',
  evidence: 'Contract and separate monthly statements; inferred allocation.',
  installments: [
    { number: 1, total: 2, date: '2026-01-19', amount: 1_100_000, principal: 1_000_000,
      interest: 100_000, balance: 9_000_000, days: 30, statementId: 'statement1',
      cutoff: { used: 9_500_000, billed: 500_000, unbilledAdjustment: 0 } },
    { number: 2, total: 2, date: '2026-02-19', amount: 1_100_000, principal: 1_010_000,
      interest: 90_000, balance: 7_990_000, days: 30, statementId: 'statement2',
      cutoff: { used: 8_590_000, billed: 500_000, unbilledAdjustment: 100_000,
        adjustmentStatementId: 'next-statement', adjustmentEvidence: 'One unbilled purchase on the cutoff date.' } },
  ],
});
const snapshot = () => ({
  accounts: [{ id: 'card', name: 'Card', offbudget: false, closed: false }],
  categories: [{ id: 'fees', name: 'Interest & Fees', is_income: false, hidden: false }],
  payees: [{ id: 'to-card', transfer_acct: 'card', name: 'Card' },
    { id: 'bank', name: 'Bank', transfer_acct: null }], transactions: [],
  schedules: [], rules: [], balances: { card: -10_000_000 },
});

test('previews a source-backed principal and interest allocation', async () => {
  const { classifyRefinancing } = await subject();
  const result = classifyRefinancing(candidate(), snapshot(), {});
  assert.equal(result.action, 'create');
  assert.equal(result.principalRemaining, 7_990_000);
  assert.equal(result.totalInterest, 190_000);
});

test('rejects a cutoff that does not support the proposed balance', async () => {
  const { classifyRefinancing } = await subject();
  const c = candidate(); c.installments[1].cutoff.used += 100;
  assert.throws(() => classifyRefinancing(c, snapshot(), {}), /cutoff/i);
});

test('rejects an interest amount inconsistent with the disclosed rate', async () => {
  const { classifyRefinancing } = await subject();
  const c = candidate(); c.installments[0].interest += 100;
  c.installments[0].principal -= 100; c.installments[0].balance += 100;
  c.installments[0].cutoff.used += 100;
  assert.throws(() => classifyRefinancing(c, snapshot(), {}), /interest/i);
});

test('halts when a same-name account or partial source exists without audit', async () => {
  const { classifyRefinancing } = await subject();
  const s = snapshot(); s.accounts.push({ id: 'other', name: 'Debt test', closed: false });
  assert.equal(classifyRefinancing(candidate(), s, {}).action, 'review');
  const t = snapshot(); t.transactions.push({ id: 'partial', imported_id: 'bank:test:refinance:opening' });
  assert.equal(classifyRefinancing(candidate(), t, {}).action, 'review');
});

test('halts when the durable operation is pending', async () => {
  const { classifyRefinancing } = await subject();
  assert.equal(classifyRefinancing(candidate(), snapshot(), {
    cardRefinancings: { 'bank:test:refinance': { status: 'pending' } },
  }).action, 'review');
});

test('requires provenance for an unbilled cutoff adjustment', async () => {
  const { classifyRefinancing } = await subject();
  const c = candidate(); delete c.installments[1].cutoff.adjustmentStatementId;
  assert.throws(() => classifyRefinancing(c, snapshot(), {}), /adjustment statement/i);
});

test('rejects a missing interest category and a duplicate statement', async () => {
  const { classifyRefinancing } = await subject();
  const s = snapshot(); s.categories = [];
  assert.throws(() => classifyRefinancing(candidate(), s, {}), /interest category/i);
  const c = candidate(); c.installments[1].statementId = c.installments[0].statementId;
  assert.throws(() => classifyRefinancing(c, snapshot(), {}), /duplicate statement/i);
});

test('rejects a skipped billing month in the installment sequence', async () => {
  const { classifyRefinancing } = await subject();
  const c = candidate(); c.installments[1].date = '2026-03-19';
  assert.throws(() => classifyRefinancing(c, snapshot(), {}), /billing month/i);
});

test('does not post installments that are still in the future', async () => {
  const { createRefinancing } = await subject();
  await withOfflineBudget(async ({ c, ctx, getState }) => {
    ctx.today = () => '2026-01-20';
    await assert.rejects(() => createRefinancing(c, true, ctx), /future installments/i);
    assert.equal(getState().cardRefinancings, undefined);
  });
});

async function withOfflineBudget(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'actual-refinancing-test-'));
  try {
    await actual.init({ dataDir: dir });
    await actual.runImport('Offline test', async () => {});
    const card = await actual.createAccount({ name: 'Card', offbudget: false, closed: false }, 0);
    const group = await actual.createCategoryGroup({ name: 'Fees', is_income: false });
    const fees = await actual.createCategory({ name: 'Interest', group_id: group, is_income: false });
    const bank = await actual.createPayee({ name: 'Bank' });
    const other = await actual.createAccount({ name: 'Unrelated', offbudget: false, closed: false }, 0);
    await actual.addTransactions(other, [{ date: '2026-01-02', amount: -12_300, payee: bank,
      category: fees, imported_id: 'unrelated', notes: 'Preserve me', cleared: false }],
    { runTransfers: false, learnCategories: false });
    await actual.createSchedule({ name: 'Future reminder', posts_transaction: false, payee: bank,
      account: card, amount: -12_300, amountOp: 'is', date: '2026-04-19' });
    const c = candidate(); c.cardAccount = card; c.interestCategory = fees; c.payeeId = bank;
    let state = { activeRun: { id: 'test' } };
    const proxy = { ...actual, shutdown: async () => {}, sync: async () => {} };
    const snapshot = async api => {
      const accounts = await api.getAccounts(), transactions = [], balances = {};
      for (const a of accounts) {
        transactions.push(...await api.getTransactions(a.id, '1900-01-01', '2100-01-01'));
        balances[a.id] = await api.getAccountBalance(a.id, '2100-01-01');
      }
      return { accounts, transactions, balances, payees: await api.getPayees(),
        categories: await api.getCategories(), rules: await api.getRules(), schedules: await api.getSchedules() };
    };
    const ctx = {
      connect: async () => ({ api: proxy }), snapshot,
      backup: async () => dir,
      json: async (file, value) => writeFile(file, JSON.stringify(value)),
      requireRun: async () => structuredClone(state), readState: async () => structuredClone(state),
      save: async value => { state = structuredClone(value); },
      today: () => '2026-03-01',
      budgets: { CLP: { syncId: 'offline' } },
    };
    await fn({ c, ctx, snapshot, proxy, getState: () => state });
  } finally {
    await actual.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
}

test('offline posting preserves one gross card line per installment and tracks only principal in debt', async () => {
  const { createRefinancing } = await subject();
  assert.equal(typeof createRefinancing, 'function', 'Posting is not implemented');
  await withOfflineBudget(async ({ c, ctx, snapshot, proxy }) => {
    const result = await createRefinancing(c, true, ctx);
    assert.equal(result.verified, true);
    const after = await snapshot(proxy), card = after.transactions.filter(t => t.account === c.cardAccount);
    assert.equal(card.length, 3);
    assert.equal(card.filter(t => t.is_parent).length, 2);
    assert.deepEqual(card.filter(t => t.is_parent).map(t => t.amount).sort(), [-1_100_000, -1_100_000]);
    assert.equal(after.balances[c.cardAccount], 7_800_000);
    assert.equal(after.balances[result.debtAccount], -7_990_000);
    assert.equal((await createRefinancing(c, true, ctx)).action, 'existing');
    const again = await snapshot(proxy);
    assert.equal(again.transactions.length, after.transactions.length);
  });
});

test('interruption after a financial write leaves a durable pending audit and blocks retry', async () => {
  const { createRefinancing } = await subject();
  assert.equal(typeof createRefinancing, 'function', 'Posting is not implemented');
  await withOfflineBudget(async ({ c, ctx, proxy, getState }) => {
    const add = proxy.addTransactions;
    proxy.addTransactions = async (...args) => { await add(...args); throw new Error('simulated interruption'); };
    await assert.rejects(() => createRefinancing(c, true, ctx), /simulated interruption/);
    assert.equal(getState().cardRefinancings[c.sourceKey].status, 'pending');
    proxy.addTransactions = add;
    assert.equal((await createRefinancing(c, true, ctx)).action, 'review');
  });
});
