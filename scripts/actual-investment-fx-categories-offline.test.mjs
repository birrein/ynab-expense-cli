import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import { ensureFxCategory } from './actual-investment-fx-categories.mjs';

test('official API creates directional transfer categories in an isolated budget', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'actual-fx-categories-')); let ledger = {}, count = 0;
  try {
    const rt = await api.init({ dataDir:tmp });
    await rt.send('create-budget', { budgetName:'Offline FX categories', avoidUpload:true });
    const snapshot = async a => {
      const accounts = await a.getAccounts(), transactions = [], balances = {};
      for (const account of accounts) {
        transactions.push(...await a.getTransactions(account.id, '1900-01-01', '2100-01-01'));
        balances[account.id] = await a.getAccountBalance(account.id, '2100-01-01');
      }
      return { accounts, transactions, balances, categories:await a.getCategories(), payees:await a.getPayees(), rules:await a.getRules(), schedules:await a.getSchedules() };
    };
    const d = { budgets:{ USD:{syncId:'same'}, CLP:{syncId:'same'} },
      connect:async () => ({ api:{ ...api, sync:async()=>{}, shutdown:async()=>{} } }), snapshot,
      readState:async()=>structuredClone(ledger), requireRun:async()=>structuredClone(ledger),
      save:async x=>{ledger=structuredClone(x);}, backup:async()=>{const dir=join(tmp, 'backup-'+(++count));await mkdir(dir);return dir;}, json:async()=>{} };
    const common = { investmentFxCategory:true, evidence:'Category for independently evidenced investment currency conversion.' };
    const usd = { ...common, currency:'USD', name:'Transferencias entre monedas / Salida USD', groupName:'Transferencias entre monedas', isIncome:false };
    const clp = { ...common, currency:'CLP', name:'Transferencias entre monedas / Entrada CLP', groupName:'Income', isIncome:true };
    const a = await ensureFxCategory(usd, true, d), b = await ensureFxCategory(clp, true, d);
    assert(a.verified && b.verified);
    assert.equal((await ensureFxCategory(usd, true, d)).action, 'existing');
    assert.equal((await ensureFxCategory(clp, true, d)).action, 'existing');
    const categories = await api.getCategories();
    assert(categories.some(c => c.id === a.categoryId && !c.is_income));
    assert(categories.some(c => c.id === b.categoryId && c.is_income));
  } finally { try { await api.shutdown(); } catch {} await rm(tmp, { recursive:true, force:true }); }
});
