import * as api from '/Users/birrein/.nvm/versions/node/v22.20.0/lib/node_modules/@actual-app/cli/node_modules/@actual-app/api/dist/index.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/Users/birrein/Actual-pilot/financisto-pilot-20260904';
const run=root+'/fx-categories-'+Date.now();await mkdir(run+'/client',{recursive:true,mode:0o700});
const runtime=await api.init({serverURL:'http://127.0.0.1:5006',sessionToken:process.env.ACTUAL_SESSION_TOKEN,dataDir:run+'/client'});
const results=[];
async function snapshot(){const rows=[];for(const a of await api.getAccounts())rows.push(...await api.getTransactions(a.id,'1900-01-01','2100-01-01'));return rows;}
try{for(const [currency,syncId] of [['CLP','5c58e53d-be34-4968-b944-f5b3b8b3b874'],['USD','da939d35-040a-4a5a-9309-f83aa809a1c6']]){
await api.downloadBudget(syncId);const b=(await api.getBudgets()).find(b=>b.id&&b.groupId===syncId);await api.loadBudget(b.id);
const before=await snapshot();const selected=before.filter(t=>/^financisto-csv-/.test(t.imported_id||'')&&/\[financisto-fx:\d+-\d+\]/.test(t.notes||''));assert.equal(selected.length,221);
for(const t of selected){assert.ok(!t.transfer_id);assert.ok(currency==='CLP'?t.amount<0:t.amount>0);}
const widgets=(await api.runQuery(api.q('dashboard').select('*'))).data;
function targeted(w){return ['cash-flow-card','spending-card'].includes(w.type)||(w.type==='summary-card'&&(w.meta?.conditions||[]).some(c=>c.field==='amount'&&['gt','lt'].includes(c.op)));}
for(const w of widgets.filter(targeted))assert.ok(!w.meta?.conditions?.length||!w.meta.conditionsOp||w.meta.conditionsOp==='and','OR filters require explicit composition');
await writeFile(run+'/'+currency+'-before.zip',await api.exportBudget(),{mode:0o600});
await writeFile(run+'/'+currency+'-before.json',JSON.stringify({before,widgets},null,2),{mode:0o600});
const income=currency==='USD';const groups=await api.getCategoryGroups();let group=income?groups.find(g=>g.is_income&&g.name==='Income')||groups.find(g=>g.is_income):groups.find(g=>!g.is_income&&g.name==='Transferencias entre monedas');
if(!group){assert.ok(!income);const id=await api.createCategoryGroup({name:'Transferencias entre monedas'});group={id};}
const name=income?'Transferencias entre monedas / Entrada USD':'Salida CLP';
let category=(await api.getCategories()).find(c=>c.group_id===group.id&&c.name===name);
if(!category)category={id:await api.createCategory({name,group_id:group.id,is_income:income})};
const updates=selected.filter(t=>t.category!==category.id).map(t=>({id:t.id,category:category.id}));
const updatedWidgets=widgets.filter(targeted).map(w=>({...w,meta:{...w.meta,conditionsOp:'and',conditions:[...(w.meta?.conditions||[]).filter(c=>!(c.field==='category'&&c.op==='isNot'&&c.value===category.id)),{field:'category',op:'isNot',value:category.id}]}}));
for(let i=0;i<updates.length;i+=100){await runtime.send('transactions-batch-update',{updated:updates.slice(i,i+100),runTransfers:false});await api.sync();}
for(const w of updatedWidgets)await runtime.send('dashboard-update-widget',w);
await api.sync();const after=await snapshot();const map=new Map(after.map(t=>[t.id,t]));const touched=new Set(selected.map(t=>t.id));assert.equal(after.length,before.length);
for(const t of before)assert.deepEqual(map.get(t.id),touched.has(t.id)?{...t,category:category.id}:t);
const current=(await api.runQuery(api.q('dashboard').select('*'))).data;const changed=new Map(updatedWidgets.map(w=>[w.id,w]));for(const w of widgets)assert.deepEqual(current.find(a=>a.id===w.id),changed.get(w.id)||w);
results.push({currency,syncId,categoryId:category.id,transactions:selected.length,widgets:updatedWidgets.length,verified:true});await writeFile(run+'/result.json',JSON.stringify(results,null,2),{mode:0o600});console.log(JSON.stringify(results.at(-1)));await runtime.send('close-budget');
}}finally{await api.shutdown();}
console.log('Evidence: '+run);
