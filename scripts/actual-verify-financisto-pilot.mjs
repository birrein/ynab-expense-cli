import * as api from '/Users/birrein/.nvm/versions/node/v22.20.0/lib/node_modules/@actual-app/cli/node_modules/@actual-app/api/dist/index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { buildImportPlan, parseFinancistoCsv } from './financisto-actual-import.mjs';
const root = '/Users/birrein/Actual-pilot/financisto-pilot-20260904';
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const plan = buildImportPlan(parseFinancistoCsv(await readFile('/Users/birrein/Library/CloudStorage/GoogleDrive-birrein@gmail.com/Mi unidad/financisto/20220218_141658_957.csv', 'utf8')), { cutoff: '2022-02-18' });
await mkdir(`${root}/verify-client`, { recursive: true, mode: 0o700 });
await api.init({ serverURL: 'http://127.0.0.1:5006', sessionToken: process.env.ACTUAL_SESSION_TOKEN, dataDir: `${root}/verify-client` });
const results = [];
try {
  for (const entry of manifest) {
    await api.downloadBudget(entry.copy.groupId);
    const budget = (await api.getBudgets()).find(b => b.id && b.groupId === entry.copy.groupId);
    await api.loadBudget(budget.id);
    const accounts = await api.getAccounts();
    const categories = new Map((await api.getCategories()).map(c => [c.id, c.name]));
    let imported = 0;
    for (const group of plan.groups.filter(g => g.currency === entry.currency)) {
      const account = accounts.find(a => a.name === group.targetAccount);
      assert.ok(account && !account.offbudget);
      const tx = await api.getTransactions(account.id, '1900-01-01', '2100-01-01');
      assert.equal(tx.length, group.transactions.length);
      const byId = new Map(tx.map(t => [t.imported_id, t]));
      assert.equal(byId.size, tx.length);
      for (const expected of group.transactions) {
        const actual = byId.get(expected.imported_id);
        assert.ok(actual);
        assert.equal(actual.amount, expected.amount);
        assert.equal(actual.date, expected.date);
        if (expected.categoryLabel) assert.equal(categories.get(actual.category), expected.categoryLabel);
      }
      imported += tx.length;
    }
    let ynab = 0;
    for (const a of accounts.filter(a => !a.name.startsWith('Financisto histórico / '))) ynab += (await api.getTransactions(a.id, '1900-01-01', '2100-01-01')).length;
    assert.equal(ynab, entry.sourceTransactions);
    results.push({ currency: entry.currency, budget: entry.copy.name, imported, ynab, verified: true });
  }
  await writeFile(`${root}/verification.json`, JSON.stringify(results, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(results, null, 2));
} finally { await api.shutdown(); }
