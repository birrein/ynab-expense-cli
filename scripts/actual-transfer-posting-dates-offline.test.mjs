import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import {correctPostingDates} from './actual-transfer-posting-dates.mjs';

for(const mode of ['different','later','manual','receipt','early'])test(`official API retains ${mode} posting dates and reciprocal IDs after independent reopen`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-posting-dates-'));let ledger={};
 try{
  const rt=await api.init({dataDir:root});await rt.send('create-budget',{budgetName:'Posting dates offline',avoidUpload:true});const budget=(await api.getBudgets())[0].id;
  const origin=await api.createAccount({name:'Checking'}),destination=await api.createAccount({name:'Card'}),payee=(await api.getPayees()).find(x=>x.transfer_acct===destination);
  await api.addTransactions(origin,[{date:'2024-12-02',amount:-150000000,payee:payee.id,cleared:false}],{runTransfers:true,learnCategories:false});
  const a=(await api.getTransactions(origin,'2024-01-01','2025-01-01'))[0],b=(await api.getTransactions(destination,'2024-01-01','2025-01-01'))[0];await api.shutdown();
  const candidate={historicalTransferPostingDates:true,currency:'CLP',oldOrigin:a,oldDestination:b,originDate:mode==='manual'?'2024-12-08':['later','early'].includes(mode)?'2024-12-05':mode==='receipt'?'2024-12-03':'2024-12-02',destinationDate:mode==='manual'?'2024-12-08':['later','early'].includes(mode)?'2024-12-05':mode==='receipt'?'2024-12-02':'2024-11-29',receiptId:'1937a3c1ebc45fa3',originStatementId:'checking-statement',destinationStatementId:'card-statement',evidence:'Synthetic receipt and statements support independently observed posting dates.'};if(['manual','later','early'].includes(mode))candidate.bothStatementPostingDate={receiptDate:mode==='manual'?'2024-12-08':mode==='early'?'2024-12-01':'2024-12-02',originStatementDate:candidate.originDate,destinationStatementDate:candidate.destinationDate};if(mode==='early')candidate.receiptBeforeHistorical=true;if(mode==='manual')candidate.historicalDateUnreliable=true;if(mode==='receipt'){delete candidate.destinationStatementId;candidate.destinationReceiptEvidence={receiptId:'19484a977d96c190',date:'2024-12-02'}}
  const snapshot=async x=>{const accounts=await x.getAccounts(),transactions=[],balances={};for(const a of accounts){transactions.push(...await x.getTransactions(a.id,'1900-01-01','2100-01-01'));balances[a.id]=await x.getAccountBalance(a.id,'2100-01-01')}return{accounts,transactions,balances,payees:await x.getPayees(),categories:await x.getCategories(),rules:await x.getRules(),schedules:await x.getSchedules()}};
  const d={async connect(){await api.init({dataDir:root});await api.loadBudget(budget);return{api:{...api,sync:async()=>{}}}},snapshot,async readState(){return structuredClone(ledger)},async requireRun(){return structuredClone(ledger)},async save(x){ledger=structuredClone(x)},async json(){},async backup(x){const dir=join(root,'backup');await mkdir(dir);await writeFile(join(dir,'budget.zip'),await x.exportBudget());return dir}};
  d.expectedPlan=(await correctPostingDates(candidate,false,d)).planHash;assert((await correctPostingDates(candidate,true,d)).verified);assert.equal(ledger.transferPostingDateCorrections[a.id].status,'complete');assert.equal((await correctPostingDates(candidate,true,d)).action,'existing');
  const {api:check}=await d.connect();const after=await snapshot(check),x=after.transactions.find(t=>t.id===a.id),y=after.transactions.find(t=>t.id===b.id);assert.equal(x.date,candidate.originDate);assert.equal(y.date,candidate.destinationDate);assert.equal(x.transfer_id,y.id);assert.equal(y.transfer_id,x.id);await check.shutdown();
 }finally{try{await api.shutdown()}catch{}await rm(root,{recursive:true,force:true})}
});
