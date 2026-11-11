import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import { recordInvestmentFx } from './actual-investment-fx.mjs';

test('official Actual API preserves explicit investment legs and balances in an isolated budget', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'actual-investment-fx-')); let ledger = {};
  try {
    const rt = await api.init({ dataDir: tmp });
    await rt.send('create-budget', { budgetName: 'Offline investment FX test', avoidUpload: true });
    const clp = await api.createAccount({ name: 'CLP Cash', offbudget: false, closed: false });
    const usd = await api.createAccount({ name: 'USD Cash', offbudget: false, closed: false });
    const group = await api.createCategoryGroup({ name: 'Currency Transfers', is_income: false });
    const out = await api.createCategory({ name: 'Transferencias entre monedas / Salida USD', group_id: group, is_income: false });
    const incomeGroup = (await api.getCategories()).find(c => c.name === 'Income' && c.is_income).group_id;
    const inc = await api.createCategory({ name: 'Transferencias entre monedas / Entrada CLP', group_id: incomeGroup, is_income: true });
    const p = {
      investmentFxConversion: true, date: '2026-07-08', reference: 'FX-INVESTMENT-2026-07-08-TEST',
      statementFileIds: ['stockstatement123','cashstatement456'],
      gmailMessageIds: ['19f4a298376e9042'],
      evidence: 'Synthetic independent statements show the exact cash conversion in both investment accounts.',
      reportingEvidence: 'Synthetic report preflight confirms exclusion of opening balances and correct transfer categories.',
      clp: { account: clp, amount: 20036200, category: inc, sourceId: 'bank:test:investment:clp' },
      usd: { account: usd, amount: -21663, category: out, sourceId: 'bank:test:investment:usd' },
    };
    const snapshot = async a => {
      const id = a._currency === 'CLP' ? clp : usd;
      return { accounts: (await a.getAccounts()).filter(x => x.id === id),
        transactions: await a.getTransactions(id, '1900-01-01', '2100-01-01'),
        balances: { [id]: await a.getAccountBalance(id, '2100-01-01') }, categories: await a.getCategories(),
        payees: await a.getPayees(), rules: await a.getRules(), schedules: await a.getSchedules() };
    };
    const d = { budgets: { CLP: { syncId: 'clp' }, USD: { syncId: 'usd' } },
      connect: async id => ({ api: { ...api, _currency: id === 'clp' ? 'CLP' : 'USD', sync: async () => {}, shutdown: async () => {} } }),
      snapshot, readState: async () => structuredClone(ledger), requireRun: async () => structuredClone(ledger),
      save: async l => { ledger = structuredClone(l); }, backup: async (_a, c) => { const path = join(tmp, 'backup-' + c); await mkdir(path); return path; }, json: async () => {} };
    const result = await recordInvestmentFx(p, true, d);
    assert.equal(result.verified, true);
    assert.equal(await api.getAccountBalance(clp, '2100-01-01'), 20036200);
    assert.equal(await api.getAccountBalance(usd, '2100-01-01'), -21663);
    assert.equal((await recordInvestmentFx(p, true, d)).action, 'existing');
  } finally { try { await api.shutdown(); } catch {} await rm(tmp, { recursive: true, force: true }); }
});
