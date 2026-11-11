import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import {recordMixedComponent,amendMixedComponentNote} from './actual-uber-mixed-component.mjs';

for(const [merchant,categoryName] of [['Uber','Transportation'],['Uber Eats','Eating Out & Delivery']]) test(`official Actual API independently persists a mixed ${merchant} component in an isolated budget`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-mixed-offline-'));let ledger={cashflows:{}};
 try{
  const rt=await api.init({dataDir:root});await rt.send('create-budget',{budgetName:'Mixed offline',avoidUpload:true});const budget=(await api.getBudgets())[0].id;
  const card=await api.createAccount({name:'CMR',offbudget:false,closed:false});const wallet=await api.createAccount({name:'Uber Cash - historial parcial',offbudget:false,closed:false});
  const payee=await api.createPayee({name:merchant}),group=await api.createCategoryGroup({name:'Expense'}),category=await api.createCategory({name:categoryName,group_id:group,is_income:false});
  const receipt='193384b35772aba9',statement='statement-id',key='bank:ride';
  await api.addTransactions(card,[{date:'2024-11-17',amount:-285500,payee,category,notes:`Parte de Uber Cash pendiente.\nhttps://mail.google.com/mail/u/0/#all/${receipt}\nhttps://drive.google.com/file/d/${statement}/view`,imported_id:key}],{runTransfers:false,learnCategories:false});
  const original=(await api.getTransactions(card,'2024-11-17','2024-11-17'))[0];await api.shutdown();
  const record={type:'expense',status:'registered',verifiedAt:'2026-01-01',id:original.id,account:card,date:original.date,amount:original.amount,category,sourceIds:[receipt],driveFileIds:[statement]};ledger.cashflows[key]=record;
  const candidate={mixedUberCashComponent:true,currency:'CLP',wallet,receipt,statementFileId:statement,cardSourceKey:key,cardTransaction:original,cardRecord:record,amount:-24300,total:-309800,evidence:'Offline test verifies the complete receipt and matching bank statement.'};
  const snapshot=async a=>{const accounts=await a.getAccounts(),transactions=[],balances={};for(const x of accounts){transactions.push(...await a.getTransactions(x.id,'1900-01-01','2100-01-01'));balances[x.id]=await a.getAccountBalance(x.id,'2100-01-01')}return {accounts,transactions,balances,categories:await a.getCategories(),payees:await a.getPayees(),rules:await a.getRules(),schedules:await a.getSchedules()}};
  let backupNumber=0;const d={async connect(){await api.init({dataDir:root});await api.loadBudget(budget);return {api:{...api,sync:async()=>{}}}},snapshot,async readDashboard(){return []},async readState(){return structuredClone(ledger)},async requireRun(){return structuredClone(ledger)},async save(x){ledger=structuredClone(x)},async json(){},async backup(a){const dir=join(root,'backup-'+(++backupNumber));await mkdir(dir);await writeFile(join(dir,'budget.zip'),await a.exportBudget());return dir}};
  const plan=await recordMixedComponent(candidate,false,d);d.expectedPlan=plan.planHash;const done=await recordMixedComponent(candidate,true,d);assert(done.verified);assert.equal(ledger.mixedUberCashComponents[receipt].status,'complete');assert.equal((await recordMixedComponent(candidate,true,d)).id,done.id);
  const amendment={mixedUberCashNoteAmendment:true,currency:'CLP',receipt,oldText:'Parte de Uber Cash pendiente',newText:'Parte de Uber Cash registrada',evidence:'Offline verification proves the card and wallet components share this receipt.'};const preview=await amendMixedComponentNote(amendment,false,d);d.expectedPlan=preview.planHash;assert((await amendMixedComponentNote(amendment,true,d)).verified);d.expectedPlan=plan.planHash;assert.equal((await recordMixedComponent(candidate,true,d)).action,'existing');
  const {api:check}=await d.connect();assert.equal(await check.getAccountBalance(wallet,'2100-01-01'),-24300);assert.equal((await check.getTransactions(card,'1900-01-01','2100-01-01')).length,1);await check.shutdown();
 }finally{try{await api.shutdown()}catch{}await rm(root,{recursive:true,force:true})}
});
