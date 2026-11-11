import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import {correctSplitDate} from './actual-split-date.mjs';

for(const cleared of [true,false])test(`official Actual API corrects a split date preserving cleared=${cleared}`,async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'actual-split-date-'));let ledger={};
 try{
  const rt=await api.init({dataDir:tmp});await rt.send('create-budget',{budgetName:'Offline Split Date',avoidUpload:true});
  const account=await api.createAccount({name:'Card',offbudget:false,closed:false});
  const group=await api.createCategoryGroup({name:'Test',is_income:false});
  const clean=await api.createCategory({name:'Cleaning',group_id:group,is_income:false});
  const bike=await api.createCategory({name:'Cycling',group_id:group,is_income:false});
  const payee=await api.createPayee({name:'Mercado Libre'});
  const other=await api.createPayee({name:'Seller'});
  await api.addTransactions(account,[{date:'2024-01-14',amount:-2869700,payee,is_parent:true,notes:'evidence',cleared,subtransactions:[{amount:-1521700,category:clean,payee,notes:'detergent'},{amount:-1348000,category:bike,payee:other,notes:'patches'}]}],{runTransfers:false,learnCategories:false});
  const old=(await api.getTransactions(account,'2024-01-14','2024-01-14')).find(t=>t.is_parent);assert(old);
  assert.equal(old.cleared,cleared);assert(old.subtransactions.every(c=>c.cleared===cleared));
  const p={historicalSplitDateCorrection:true,currency:'CLP',oldParent:old,newDate:'2024-01-18',preserveCleared:cleared,purchaseMessageId:'abcd1234',statementFileId:'statement123',evidence:'Synthetic matching purchase and statement for a safe date correction test.'};
  const snapshot=async a=>{const accounts=await a.getAccounts(),transactions=[];for(const x of accounts)transactions.push(...await a.getTransactions(x.id,'1900-01-01','2100-01-01'));const balances={};for(const x of accounts)balances[x.id]=await a.getAccountBalance(x.id,'2100-01-01');return{accounts,transactions,categories:await a.getCategories(),payees:await a.getPayees(),rules:await a.getRules(),schedules:await a.getSchedules(),balances}};
  const isolated={...api,sync:async()=>{},shutdown:async()=>{}};
  const d={connect:async()=>({api:isolated}),snapshot,requireRun:async()=>structuredClone(ledger),readState:async()=>structuredClone(ledger),save:async l=>{ledger=structuredClone(l)},backup:async()=>{let path=join(tmp,'backup');await mkdir(path,{recursive:true});return path},json:async()=>{}};
  const result=await correctSplitDate(p,true,d);assert.equal(result.verified,true);assert.equal((await correctSplitDate(p,true,d)).action,'existing');
 }finally{try{await api.shutdown()}catch{}await rm(tmp,{recursive:true,force:true})}
});
