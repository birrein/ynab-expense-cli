import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';

test('uncategorized credit changes account balance and needs explicit income-widget exclusion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'actual-credit-behavior-'));
  try {
    const rt = await api.init({ dataDir: root });
    await rt.send('create-budget', { budgetName: 'Credit behavior', avoidUpload: true });
    const account = await api.createAccount({ name: 'Card' });
    const payee = await api.createPayee({ name: 'Bank' });
    const month = (await api.getBudgetMonths()).at(-3);
    const date = `${month}-01`;
    const before = await api.getBudgetMonth(month);
    await api.addTransactions(account, [
      { date, amount: 2000000, payee, category: null, notes: 'source=bank:test:credit' },
      { date, amount: 100000, payee, category: null, notes: null },
      { date, amount: 300000, payee, category: null, notes: 'Other income' },
    ], { runTransfers: false, learnCategories: false });
    const after = await api.getBudgetMonth(month);
    assert.equal(await api.getAccountBalance(account, '2100-01-01'), 2400000);
    for (const key of ['incomeAvailable', 'totalIncome', 'totalSpent', 'toBudget']) {
      assert.equal(after[key], before[key], key);
    }
    const all = await api.runQuery(api.q('transactions').select(['amount', 'notes']).filter({ amount: { $gt: 0 } }));
    assert.equal(all.data.reduce((n, t) => n + t.amount, 0), 2400000);
    const filtered = await api.runQuery(api.q('transactions').select(['amount', 'notes']).filter({
      amount: { $gt: 0 }, notes: { $notlike: '%source=bank:test:credit%' },
    }));
    assert.deepEqual(filtered.data.map(t => t.amount).sort((a, b) => a - b), [100000, 300000]);
  } finally {
    await api.shutdown();
    await rm(root, { recursive: true, force: true });
  }
});
