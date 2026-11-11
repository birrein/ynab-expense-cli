import * as api from '/Users/birrein/.nvm/versions/node/v22.20.0/lib/node_modules/@actual-app/cli/node_modules/@actual-app/api/dist/index.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='/Users/birrein/Actual-pilot/financisto-pilot-20260904';
const review=JSON.parse(await readFile(root+'/transfer-review.json'));
const pairs=review.pairs.filter(p=>p.kind==='cross-currency'&&p.included);
const resolved=review.exceptions.find(e=>e.timestamp==='2013-07-29 10:44:35');
assert.ok(resolved);
for(const [outRecord,inRecord,outAmount,inAmount] of [[11881,11882,-48500,94],[11883,11884,-183100,355]]){
const outgoing=resolved.members.find(r=>r.record===outRecord),incoming=resolved.members.find(r=>r.record===inRecord);
assert.equal(outgoing?.cents,outAmount);assert.equal(incoming?.cents,inAmount);
assert.equal(outgoing.account,'BCI Cta Cte');assert.equal(incoming.account,'BCI Crédito USD');
assert.equal(outgoing.currency,'CLP');assert.equal(incoming.currency,'USD');
pairs.push({outgoing,incoming,timestamp:resolved.timestamp,included:true,kind:'cross-currency',inferred:true});
}
function iid(r){return 'financisto-csv-'+createHash('sha256').update([r.record-1,...['date','time','account','amount','currency','original amount','original currency','category','parent','payee','location','project','note'].map(k=>r[k])].map(x=>String(x??'')).join('\u001f')).digest('hex').slice(0,32);}
const run=root+'/fx-reference-'+Date.now();await mkdir(run+'/client',{recursive:true,mode:0o700});
const runtime=await api.init({serverURL:'http://127.0.0.1:5006',sessionToken:process.env.ACTUAL_SESSION_TOKEN,dataDir:run+'/client'});
const plans=[];
try{
for(const [currency,syncId] of [['CLP','5c58e53d-be34-4968-b944-f5b3b8b3b874'],['USD','da939d35-040a-4a5a-9309-f83aa809a1c6']]){
await api.downloadBudget(syncId);const b=(await api.getBudgets()).find(b=>b.id&&b.groupId===syncId);await api.loadBudget(b.id);
await writeFile(run+'/'+currency+'-before.zip',await api.exportBudget(),{mode:0o600});
const accounts=await api.getAccounts();const before=[];for(const a of accounts)before.push(...await api.getTransactions(a.id,'1900-01-01','2100-01-01'));
const tx=new Map(before.map(t=>[t.imported_id,t]));const updated=[];
for(const p of pairs){for(const r of [p.outgoing,p.incoming].filter(r=>r.currency===currency)){
const t=tx.get(iid(r));assert.ok(t);assert.equal(t.amount,r.cents);assert.equal(t.date,r.date);assert.equal(accounts.find(a=>a.id===t.account)?.name,'Financisto histórico / '+r.account);assert.ok(!t.transfer_id);
const ref=`[financisto-fx:${p.outgoing.record}-${p.incoming.record}]`;
const note=`${ref} Transferencia entre presupuestos: ${p.outgoing.account} (${p.outgoing.amount} ${p.outgoing.currency}) → ${p.incoming.account} (${p.incoming.amount} ${p.incoming.currency}). Fecha y hora origen: ${p.timestamp}.`+(p.inferred?' Pareja inferida por orden del CSV y tipo de cambio consistente; criterio aceptado por el usuario, sin comprobación con cartola.':'');
if(!(t.notes||'').includes(ref))updated.push({id:t.id,notes:[t.notes,note].filter(Boolean).join('\n')});
}}
plans.push({currency,syncId,budgetId:b.id,updated,before});
await runtime.send('close-budget');
}
await writeFile(run+'/plan.json',JSON.stringify(plans,null,2),{mode:0o600});
for(const p of plans){await api.loadBudget(p.budgetId);for(let i=0;i<p.updated.length;i+=100){await runtime.send('transactions-batch-update',{updated:p.updated.slice(i,i+100),runTransfers:false});await api.sync();}
const after=[];for(const a of await api.getAccounts())after.push(...await api.getTransactions(a.id,'1900-01-01','2100-01-01'));assert.equal(after.length,p.before.length);const map=new Map(after.map(t=>[t.id,t]));const changes=new Map(p.updated.map(t=>[t.id,t.notes]));for(const old of p.before)assert.deepEqual(map.get(old.id),changes.has(old.id)?{...old,notes:changes.get(old.id)}:old);console.log(JSON.stringify({currency:p.currency,notesUpdated:p.updated.length,verified:true}));await runtime.send('close-budget');}
await writeFile(run+'/result.json',JSON.stringify({pairs:pairs.length,verified:true,counts:plans.map(p=>({currency:p.currency,updated:p.updated.length}))},null,2),{mode:0o600});
}finally{await api.shutdown();}
console.log('Evidence: '+run);
