import * as api from '/Users/birrein/.nvm/versions/node/v22.20.0/lib/node_modules/@actual-app/cli/node_modules/@actual-app/api/dist/index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root='/Users/birrein/Actual-pilot/financisto-pilot-20260904';
const report=JSON.parse(await readFile(`${root}/transfer-review.json`));
const decision=JSON.parse(await readFile(`${root}/decision-duplicate-bch-mach.json`));
const exception=report.exceptions.find(e=>e.timestamp===decision.timestamp);
const pairs=report.pairs.filter(p=>p.kind==='same-currency'&&p.included);
pairs.push({outgoing:exception.members.find(r=>r.record===1209),incoming:exception.members.find(r=>r.record===1210)});
const cashExceptions=report.exceptions.filter(e=>['2017-01-11 21:47:03','2016-12-24 16:48:09'].includes(e.timestamp));
const duplicateRows=exception.members.filter(r=>decision.excludeRecords.includes(r.record));
for(const e of cashExceptions){
 const m=e.members;assert.equal(m.length,4);
 for(const [a,b] of [[m[0],m[2]],[m[1],m[3]]])for(const k of Object.keys(a).filter(k=>k!=='record'))assert.deepEqual(a[k],b[k]);
 pairs.push({outgoing:m[0],incoming:m[1]});duplicateRows.push(m[2],m[3]);
}
function importedId(r){return 'financisto-csv-'+createHash('sha256').update([r.record-1,...['date','time','account','amount','currency','original amount','original currency','category','parent','payee','location','project','note'].map(k=>r[k])].map(x=>String(x??'')).join('\u001f')).digest('hex').slice(0,32);}
const run=`${root}/transfer-link-${Date.now()}`;
await mkdir(`${run}/client`,{recursive:true,mode:0o700});
const runtime=await api.init({serverURL:'http://127.0.0.1:5006',sessionToken:process.env.ACTUAL_SESSION_TOKEN,dataDir:`${run}/client`});
const results=[];
try{for(const [currency,syncId] of [['CLP','5c58e53d-be34-4968-b944-f5b3b8b3b874'],['USD','da939d35-040a-4a5a-9309-f83aa809a1c6']]){
 await api.downloadBudget(syncId);const budget=(await api.getBudgets()).find(b=>b.id&&b.groupId===syncId);await api.loadBudget(budget.id);
 await writeFile(`${run}/${currency}-before.zip`,await api.exportBudget(),{mode:0o600});
 const accounts=await api.getAccounts();
 async function snapshot(){const ts=[];for(const a of accounts)ts.push(...await api.getTransactions(a.id,'1900-01-01','2100-01-01'));return ts;}
 const before=await snapshot();const byImported=new Map(before.map(t=>[t.imported_id,t]));
 const payees=new Map((await api.getPayees()).filter(p=>p.transfer_acct).map(p=>[p.transfer_acct,p.id]));
 const updated=[],deleted=[];
 const selected=pairs.filter(p=>p.outgoing.currency===currency);
 for(const p of selected){const a=byImported.get(importedId(p.outgoing)),b=byImported.get(importedId(p.incoming));assert.ok(a&&b);assert.equal(a.amount,-b.amount);assert.equal(a.date,b.date);assert.equal(a.amount,p.outgoing.cents);assert.notEqual(a.account,b.account);
  assert.equal(accounts.find(x=>x.id===a.account)?.name,`Financisto histórico / ${p.outgoing.account}`);assert.equal(accounts.find(x=>x.id===b.account)?.name,`Financisto histórico / ${p.incoming.account}`);
  assert.ok(!a.transfer_id||a.transfer_id===b.id);assert.ok(!b.transfer_id||b.transfer_id===a.id);
  assert.ok(payees.get(a.account)&&payees.get(b.account));
  updated.push({id:a.id,transfer_id:b.id,payee:payees.get(b.account),category:null},{id:b.id,transfer_id:a.id,payee:payees.get(a.account),category:null});
 }
 if(currency==='CLP')for(const r of duplicateRows){const t=byImported.get(importedId(r));if(t){assert.ok(!t.transfer_id);assert.equal(t.amount,r.cents);assert.equal(accounts.find(a=>a.id===t.account)?.name,`Financisto histórico / ${r.account}`);deleted.push({id:t.id});}}
 await writeFile(`${run}/${currency}-plan.json`,JSON.stringify({syncId,updated,deleted},null,2),{mode:0o600});
 for(let i=0;i<updated.length;i+=100){await runtime.send('transactions-batch-update',{updated:updated.slice(i,i+100),runTransfers:false,learnCategories:false});await api.sync();}
 if(deleted.length)await runtime.send('transactions-batch-update',{deleted,runTransfers:false});
 await api.sync();const after=await snapshot();const byId=new Map(after.map(t=>[t.id,t]));const removed=new Set(deleted.map(t=>t.id));const touched=new Set(updated.map(t=>t.id));
 assert.equal(after.length,before.length-deleted.length);
 for(const t of before){if(removed.has(t.id)){assert.ok(!byId.has(t.id));continue;}const a=byId.get(t.id);assert.ok(a);for(const k of ['amount','date','account','imported_id','notes'])assert.deepEqual(a[k],t[k]);if(!touched.has(t.id))assert.deepEqual(a,t);}
 for(const u of updated){const t=byId.get(u.id);assert.equal(t.transfer_id,u.transfer_id);assert.equal(t.payee,u.payee);assert.equal(t.category,null);}
 results.push({currency,syncId,pairs:selected.length,removed:deleted.length,before:before.length,after:after.length,verified:true});
 await writeFile(`${run}/result.json`,JSON.stringify(results,null,2),{mode:0o600});console.log(JSON.stringify(results.at(-1)));
}}
finally{await api.shutdown();}
console.log(`Evidence: ${run}`);
