import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import {correctOwnedPostingDate} from './actual-transfer-posting-dates.mjs';
import {classifyCashflow} from './actual-cashflow.mjs';

for(const common of [false,true])test(`official Actual API retains source and reciprocal IDs across independently reopened ${common?'common':'origin'} posting correction`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-owned-posting-'));let ledger={};
 try{
  const rt=await api.init({dataDir:root});await rt.send('create-budget',{budgetName:'Owned posting offline',avoidUpload:true});const budget=(await api.getBudgets())[0].id;
  const account=await api.createAccount({name:'Checking'}),destination=await api.createAccount({name:'Card'}),payee=(await api.getPayees()).find(x=>x.transfer_acct===destination);
  const sourceId='bank:example:20251030:card:500000',receiptId='19a3774fd48200a2',destinationStatementId='card-statement-verified';
  const c={cashflow:true,type:'transfer',currency:'CLP',account,destination,date:'2025-10-30',amount:-50000000,sourceId,sourceIds:[receiptId],driveFileIds:[destinationStatementId],evidence:'Receipt independently identifies origin and destination.',counterpartyEvidence:'Card statement independently confirms credit.',notes:'Payment'};
  const shared=['19b8208f341a3bf5','19bb2b01cd7f1e1a'];if(common){c.sourceIds.push(...shared);delete c.driveFileIds}
  const notes=[c.notes,...c.sourceIds.map(x=>`https://mail.google.com/mail/u/0/#all/${x}`),...(c.driveFileIds??[]).map(x=>`https://drive.google.com/file/d/${x}/view`),`source=${sourceId}`].join('\n');
  await api.addTransactions(account,[{date:c.date,amount:c.amount,payee:payee.id,imported_id:sourceId,notes,cleared:false}],{runTransfers:true,learnCategories:false});
  const a=(await api.getTransactions(account,'2025-01-01','2026-01-01'))[0],b=(await api.getTransactions(destination,'2025-01-01','2026-01-01'))[0];await api.shutdown();
  const record={type:'transfer',id:a.id,counterpartId:b.id,currency:c.currency,account,destination,date:c.date,amount:c.amount,category:null,sourceIds:c.sourceIds,driveFileIds:c.driveFileIds,evidence:c.evidence,counterpartyEvidence:c.counterpartyEvidence,backup:'/prior-backup',verifiedAt:'2026-11-05T00:00:00Z'};ledger={cashflows:{[sourceId]:record}};
  const p={ownedTransferPostingDate:true,currency:'CLP',sourceId,oldCandidate:c,oldRecord:record,oldOrigin:a,oldDestination:b,originDate:'2025-11-03',receiptId,originStatementId:'checking-statement-verified',destinationStatementId,evidence:'Synthetic receipt and statements independently identify one transfer with different posting dates.',...(common?{destinationDate:'2025-11-03',statementMessages:{origin:shared[0],destination:shared[1]}}:{})};
  const snapshot=async x=>{const accounts=await x.getAccounts(),transactions=[],balances={};for(const a of accounts){transactions.push(...await x.getTransactions(a.id,'1900-01-01','2100-01-01'));balances[a.id]=await x.getAccountBalance(a.id,'2100-01-01')}return{accounts,transactions,balances,payees:await x.getPayees(),categories:await x.getCategories(),rules:await x.getRules(),schedules:await x.getSchedules()}};
  const d={async connect(){await api.init({dataDir:root});await api.loadBudget(budget);return{api:{...api,sync:async()=>{}}}},snapshot,async readState(){return structuredClone(ledger)},async requireRun(){return structuredClone(ledger)},async save(x){ledger=structuredClone(x)},async json(){},async backup(x){const dir=join(root,'backup');await mkdir(dir);await writeFile(join(dir,'budget.zip'),await x.exportBudget());return dir}};
  d.expectedPlan=(await correctOwnedPostingDate(p,false,d)).planHash;assert((await correctOwnedPostingDate(p,true,d)).verified);assert.equal(ledger.ownedTransferPostingDateCorrections[a.id].status,'complete');assert.deepEqual(ledger.cashflows[sourceId],record);assert.equal((await correctOwnedPostingDate(p,true,d)).action,'existing');
  const {api:check}=await d.connect();const after=await snapshot(check),x=after.transactions.find(t=>t.id===a.id),y=after.transactions.find(t=>t.id===b.id);assert.equal(x.date,'2025-11-03');assert.equal(y.date,common?'2025-11-03':'2025-10-30');assert.equal(x.imported_id,sourceId);assert.equal(x.transfer_id,y.id);assert.equal(y.transfer_id,x.id);assert.equal(classifyCashflow(c,after,ledger).action,'existing');await check.shutdown();
 }finally{try{await api.shutdown()}catch{}await rm(root,{recursive:true,force:true})}
});
