import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the actual CLI paths with an isolated in-memory API, never Keychain/Actual.
async function cliCase({mode='plan',dropNotes=false,duplicate=false,existing=false,split=false,reserved=false,paired=false,removeCommit=false,pairedStatus='registered-pending-category',statementStatus=null},check){
 const root=await mkdtemp(join(tmpdir(),'actual-note-creation-'));
 try{
  const candidate={currency:'CLP',account:'acct',date:'2026-11-03',amount:-10000,sourceId:'abc123',sourceIds:['abc123','def456'],payeeName:'Coffee',category:split?null:'food',notes:duplicate?'Coffee #Trip #trip':'Coffee #Trip',evidence:'Authorized trip expense',...(split?{splits:[{amount:-10000,category:'food',notes:'Coffee #café'}]}:{})};
  if((paired||statementStatus)&&mode==='remove')candidate.transactionId='tx';
  const state={activeRun:{id:'run'},records:{},runs:[],dailyThrough:'2026-11-03',backfillThrough:'2026-10-09',...(reserved?{marketplaceSaleTransfers:{other:{status:'pending',candidate:{saleMessageId:'abc123'}}}}:{}),...(paired?{crossAccountStatementRefunds:{'bank:refund':{status:pairedStatus,id:'refund',candidate:{original:{id:'tx'},originalRecord:{sourceIds:['abc123']},merchantMessageId:'fe1234'}}}}:{}),...(statementStatus?{statementCredits:{abc123:{status:statementStatus,id:'tx'}}}:{})};
  await writeFile(join(root,'candidate.json'),JSON.stringify(candidate));await writeFile(join(root,'state.json'),JSON.stringify(state));
  const api=join(root,'api.mjs');
  await writeFile(api,`
   const original=${JSON.stringify(candidate)},existing=${existing},drop=${dropNotes};
   let transactions=existing?[{id:'tx',account:'acct',date:original.date,amount:original.amount,payee:'payee',category:original.category,imported_id:'gmail:abc123',notes:'Original #Trip at end'}]:[];
   export async function init(){return {};}
   export async function downloadBudget(){}
   export async function getAccounts(){return [{id:'acct',closed:false,offbudget:false}];}
   export async function getTransactions(){return transactions;}
   export async function getAccountBalance(){return transactions.reduce((n,t)=>n+t.amount,0);}
   export async function getCategories(){return [{id:'food',hidden:false}];}
   export async function getPayees(){return [{id:'payee',name:'Coffee'}];}
   export async function getRules(){return [];}
   export async function getSchedules(){return [];}
   export async function exportBudget(){return Buffer.from('synthetic zip');}
   export async function addTransactions(account,items){transactions.push(...items.map(t=>({...t,id:'tx',account,notes:drop?'Lost tag and sources':t.notes})));}
   export async function sync(){}
   export async function shutdown(){}
  `);
  let source=await readFile(new URL('./actual-daily.mjs',import.meta.url),'utf8');
  for(const file of ['actual-daily-policy.mjs','actual-transaction-notes.mjs','actual-note-tags.mjs','actual-historical-tags.mjs','actual-marketplace-sale-transfer.mjs','actual-linked-refund-category.mjs','actual-partial-account-migration.mjs','actual-uber-mixed-component.mjs','actual-statement-fx-expense.mjs','actual-statement-credit.mjs'])source=source.replaceAll("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));
  source=source.replace(/const apiPath=.*?;/,`const apiPath=${JSON.stringify(api)};`).replace(/const token=execFileSync[^\n]+/,"const token='isolated-test';");
  const cli=join(root,'cli.mjs');await writeFile(cli,source);
  const args=[cli,mode,'--file',join(root,'candidate.json'),...(mode==='apply'||(mode==='remove'&&removeCommit)?['--commit','--run-id','run']:[])];
  const result=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});
  await check(result,JSON.parse(await readFile(join(root,'state.json'),'utf8')),state);
 }finally{await rm(root,{recursive:true,force:true});}
}
test('CLI creation preview includes exact leading tags and provenance without state writes',async()=>cliCase({},(r,state,initial)=>{
 assert.equal(r.status,0,r.stderr);const plan=JSON.parse(r.stdout);
 assert.equal(plan.newNotes,'#Trip\nCoffee\nhttps://mail.google.com/mail/u/0/#all/abc123\nhttps://mail.google.com/mail/u/0/#all/def456');assert.deepEqual(state,initial);
}));
test('CLI creation preview rejects duplicate tags',async()=>cliCase({duplicate:true},(r,state,initial)=>{
 assert.equal(r.status,1);assert.match(r.stderr,/Duplicate tag/);assert.deepEqual(state,initial);
}));
test('CLI creation independently rejects missing formatted notes and secondary provenance',async()=>cliCase({mode:'apply',dropNotes:true},(r,state,initial)=>{
 assert.equal(r.status,1);assert.match(r.stderr,/notes/i);assert.deepEqual(state,initial);
}));
test('CLI split creation verifies formatted parent and child notes',async()=>cliCase({mode:'apply',split:true},(r,state)=>{
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).verified,true);assert.equal(state.records.abc123.transactionId,'tx');
}));
test('CLI existing-source verification preserves the original note layout',async()=>cliCase({mode:'apply',existing:true},(r,state)=>{
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'existing');assert.equal(state.records.abc123.transactionId,'tx');
}));

test('CLI blocks a marketplace-reserved Gmail source before ordinary preview or write',async()=>{for(const mode of ['plan','apply'])await cliCase({mode,reserved:true},(r,state,initial)=>{assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.deepEqual(state,initial);});});

test('CLI removal cannot delete a purchase in a pending linked refund pair',async()=>{for(const commit of [false,true])await cliCase({mode:'remove',paired:true,removeCommit:commit},(r,state,initial)=>{assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.deepEqual(state,initial)});});

test('CLI apply does not overwrite a purchase ledger owned by a pending refund pair',async()=>cliCase({mode:'apply',paired:true},(r,state,initial)=>{assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.deepEqual(state,initial)}));

test('CLI blocks purchase source while linked refund intent is pending',async()=>cliCase({mode:'apply',paired:true,pairedStatus:'pending'},(r,state,initial)=>{assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.deepEqual(state,initial)}));

test('CLI protects completed statement credits from unrelated changes and removal',async()=>{
 for(const mode of ['plan','apply','remove'])await cliCase({mode,statementStatus:'complete'},(r,state,initial)=>{
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.deepEqual(state,initial);
 });
});

test('CLI refuses financial writes while a statement credit is pending',async()=>{
 for(const mode of ['apply','remove'])await cliCase({mode,removeCommit:true,statementStatus:'pending'},(r,state,initial)=>{
  assert.equal(r.status,1);assert.match(r.stderr,/Pending statement credit/);assert.deepEqual(state,initial);
 });
});
