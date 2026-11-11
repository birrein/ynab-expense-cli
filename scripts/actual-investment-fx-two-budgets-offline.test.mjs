import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import { recordInvestmentFx } from './actual-investment-fx.mjs';

test('full independent readback across two distinct isolated official-API budgets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'actual-fx-two-budgets-'));
  const files = {}, setup = {}; let ledger = {};
  try {
    for (const currency of ['CLP', 'USD']) {
      const dataDir = join(root, currency); await mkdir(dataDir);
      const rt = await api.init({ dataDir });
      await rt.send('create-budget', { budgetName:'Isolated '+currency, avoidUpload:true });
      const budget = (await api.getBudgets())[0].id;
      const account = await api.createAccount({ name:currency+' cash', offbudget:false, closed:false });
      let group, category;
      if (currency === 'USD') {
        group = await api.createCategoryGroup({ name:'Transferencias entre monedas' });
        category = await api.createCategory({ name:'Transferencias entre monedas / Salida USD', group_id:group, is_income:false });
      } else {
        group = (await api.getCategories()).find(c => c.name === 'Income' && c.is_income).group_id;
        category = await api.createCategory({ name:'Transferencias entre monedas / Entrada CLP', group_id:group, is_income:true });
      }
      await api.shutdown(); files[currency] = { dataDir, budget }; setup[currency] = { account, category };
    }
    const snapshot = async a => {
      const accounts = await a.getAccounts(), transactions = [], balances = {};
      for (const acc of accounts) {
        transactions.push(...await a.getTransactions(acc.id, '1900-01-01', '2100-01-01'));
        balances[acc.id] = await a.getAccountBalance(acc.id, '2100-01-01');
      }
      return { accounts, transactions, balances, categories:await a.getCategories(), payees:await a.getPayees(), rules:await a.getRules(), schedules:await a.getSchedules() };
    };
    const d = {
      budgets:{ CLP:{syncId:'CLP'}, USD:{syncId:'USD'} },
      connect:async c => { await api.init({ dataDir:files[c].dataDir }); await api.loadBudget(files[c].budget); return { api:{...api, sync:async()=>{}} }; },
      snapshot, readState:async()=>structuredClone(ledger), requireRun:async()=>structuredClone(ledger),
      save:async x=>{ledger=structuredClone(x);},
      backup:async(a,c)=>{const dir=join(root,'backup-'+c);await mkdir(dir);return dir;}, json:async()=>{},
    };
    const p = { investmentFxConversion:true, date:'2026-07-08', reference:'FX-INVESTMENT-2026-07-08-TEST',
      statementFileIds:['stockstatement123','cashstatement456'], gmailMessageIds:['19f4a298376e9042'],
      evidence:'The two synthetic statements establish both accounts and the exact amounts for this conversion.',
      reportingEvidence:'The synthetic preflight verifies named widgets exclude opening balances and conversion categories.',
      clp:{...setup.CLP,amount:20036200,sourceId:'bank:test:investment:clp'},
      usd:{...setup.USD,amount:-21663,sourceId:'bank:test:investment:usd'} };
    const result = await recordInvestmentFx(p, true, d);
    assert.equal(result.verified,true);
    assert.equal(ledger.investmentFxConversions[p.reference].status,'complete');
    assert.equal((await recordInvestmentFx(p,true,d)).action,'existing');
    for (const currency of ['CLP','USD']) {
      const {api:client} = await d.connect(currency);
      assert.equal(await client.getAccountBalance(setup[currency].account,'2100-01-01'), currency === 'CLP' ? 20036200 : -21663);
      await client.shutdown();
    }
  } finally { try { await api.shutdown(); } catch {} await rm(root,{recursive:true,force:true}); }
});
