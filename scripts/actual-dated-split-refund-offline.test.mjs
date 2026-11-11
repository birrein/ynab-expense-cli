import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import {registerDatedSplitRefund} from './actual-dated-split-refund.mjs';

// Real API against a temporary local budget; never connects to the user's server.
test('official Actual API preserves positive and negative linked splits and net balance',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'actual-dated-split-'));let ledger={records:{},cashflows:{}};
 try{
  const rt=await api.init({dataDir:tmp});await rt.send('create-budget',{budgetName:'Offline dated split',avoidUpload:true});
  const account=await api.createAccount({name:'Synthetic card'}),group=await api.createCategoryGroup({name:'Test',is_income:false}),food=await api.createCategory({name:'Food',group_id:group,is_income:false}),care=await api.createCategory({name:'Care',group_id:group,is_income:false}),payee=await api.createPayee({name:'Synthetic store'});
  const p={datedSplitPurchaseRefund:true,currency:'CLP',account,payee,purchaseDate:'2025-10-02',refundDate:'2025-10-03',purchaseAmount:-3831500,refundAmount:150300,purchaseSources:['1111111111111111','2222222222222222'],refundSources:['3333333333333333'],statementId:'statement123',orderId:'order12345',allocations:[{category:food,net:2904200,refund:118600},{category:care,net:777000,refund:31700}],evidence:'Synthetic complete receipt and bank statements, global discount distributed proportionally as an accounting estimate.'};
  const snapshot=async a=>{const accounts=await a.getAccounts(),transactions=[];for(const x of accounts)transactions.push(...await a.getTransactions(x.id,'1900-01-01','2100-01-01'));const balances={};for(const x of accounts)balances[x.id]=await a.getAccountBalance(x.id,'2100-01-01');return {accounts,transactions,categories:await a.getCategories(),payees:await a.getPayees(),rules:await a.getRules(),schedules:await a.getSchedules(),balances};};
  const isolated={...api,sync:async()=>{},shutdown:async()=>{}},d={connect:async()=>({api:isolated}),snapshot,requireRun:async()=>structuredClone(ledger),readState:async()=>structuredClone(ledger),save:async l=>{ledger=structuredClone(l)},backup:async()=>{const path=join(tmp,'backup');await mkdir(path,{recursive:true});return path},json:async()=>{}};
  const result=await registerDatedSplitRefund(p,true,d);assert.equal(result.verified,true);assert.equal((await api.getAccountBalance(account,'2100-01-01')),-3681200);
  const retry=await registerDatedSplitRefund(p,true,d);assert.equal(retry.action,'existing');assert.equal(retry.verified,true);
 }finally{try{await api.shutdown()}catch{}await rm(tmp,{recursive:true,force:true});}
});
