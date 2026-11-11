import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import { replaceSplitInstallments } from './actual-split-installment-replacement.mjs';

// This test creates only a synthetic budget under a temporary directory. It
// does not connect to a server: Actual's offline API cannot reload a synced
// budget without attempting synchronization, so readback uses this process.
test('real Actual API preserves split items and totals in an offline synthetic budget',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'actual-split-test-'));let ledger={};
 try{
  const rt=await api.init({dataDir:tmp});await rt.send('create-budget',{budgetName:'Offline Split Test',avoidUpload:true});
  const account=await api.createAccount({name:'Card',offbudget:false,closed:false});
  const group=await api.createCategoryGroup({name:'Test',is_income:false});
  const running=await api.createCategory({name:'Running',group_id:group,is_income:false});
  const gym=await api.createCategory({name:'Gym',group_id:group,is_income:false});
  const payee=await api.createPayee({name:'Decathlon'});
  await api.addTransactions(account,[{date:'2025-08-28',amount:-6200000,payee,is_parent:true,notes:'#cuotas test',cleared:false,
   subtransactions:[{amount:-2500000,category:running,payee,notes:'short'},{amount:-200000,category:running,payee,notes:'cup'},
    {amount:-3500000,category:gym,payee,notes:'bar'}]}],{runTransfers:false,learnCategories:false});
  const old=(await api.getTransactions(account,'2025-08-28','2025-08-28')).find(t=>t.is_parent);assert(old);
  const rows=[['2025-09-19',-2066600,[-833300,-66600,-1166700]],['2025-10-19',-2066600,[-833300,-66700,-1166600]],
   ['2025-11-19',-2066800,[-833400,-66700,-1166700]]];
  const p={historicalSplitInstallmentReplacement:true,currency:'CLP',oldParent:old,purchaseMessageId:'abcd1234',
   evidence:'Synthetic statements and receipt for offline testing only.',installments:rows.map(([date,amount,allocation],i)=>({
    number:i+1,date,amount,statementId:`statement_${i+1}`,sourceId:`bank:test:split:${i+1}`,
    allocations:allocation.map((amount,j)=>({childId:old.subtransactions[j].id,amount}))}))};
  const snapshot=async a=>{const accounts=await a.getAccounts(),transactions=[];
   for(const x of accounts)transactions.push(...await a.getTransactions(x.id,'1900-01-01','2100-01-01'));
   const balances={};for(const x of accounts)balances[x.id]=await a.getAccountBalance(x.id,'2100-01-01');
   return {accounts,transactions,categories:await a.getCategories(),payees:await a.getPayees(),rules:await a.getRules(),schedules:await a.getSchedules(),balances};};
  const isolated={...api,sync:async()=>{},shutdown:async()=>{}};
  const d={connect:async()=>({api:isolated}),snapshot,requireRun:async()=>structuredClone(ledger),readState:async()=>structuredClone(ledger),
   save:async l=>{ledger=structuredClone(l)},backup:async()=>{const path=join(tmp,'backup');await mkdir(path,{recursive:true});return path},
   json:async()=>{},today:()=> '2026-11-06'};
  const result=await replaceSplitInstallments(p,true,d);assert.equal(result.verified,true);assert.equal(result.ids.length,3);
  const retry=await replaceSplitInstallments(p,true,d);assert.equal(retry.action,'existing');assert.equal(retry.verified,true);
 }finally{try{await api.shutdown()}catch{}await rm(tmp,{recursive:true,force:true});}
});
