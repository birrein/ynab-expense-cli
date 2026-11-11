import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTwinSplitDedup,retireTwinSplitDedup} from './actual-twin-split-dedup.mjs';

const split=(id,date)=>({id,account:'a',date,amount:-1550000,is_parent:true,is_child:false,category:null,payee:null,cleared:false,reconciled:false,transfer_id:null,imported_id:null,schedule:null,subtransactions:[{id:id+'a',parent_id:id,is_child:true,account:'a',date,amount:-550000,category:'food'},{id:id+'b',parent_id:id,is_child:true,account:'a',date,amount:-1000000,category:'alcohol'}]});
const fixture=()=>{const old=split('old','2024-12-28'),retained=split('retained','2024-12-27');return {p:{confirmedTwinSplitDedup:true,currency:'CLP',oldParent:old,retainedParent:retained,statementFileId:'statement123',userConfirmation:'The user confirmed these were the same purchase.',evidence:'Statement identifies a single charge and the user confirmed one purchase.'},s:{accounts:[{id:'a',closed:false,offbudget:false}],transactions:structuredClone([old,retained]),balances:{a:-3100000},categories:[],payees:[],rules:[],schedules:[]},l:{}}};
test('previews an explicitly confirmed twin split with matching allocations',()=>{const {p,s,l}=fixture();const x=classifyTwinSplitDedup(p,s,l);assert.equal(x.action,'retire');assert.equal(x.id,'old');assert.equal(x.retainedId,'retained');});
test('rejects ambiguous or unsafe splits, sources, confirmation and ownership',()=>{
 for(const [index,m] of [
  (p)=>{p.userConfirmation=''},(p)=>{p.statementFileId='bad'},(p)=>{p.retainedParent.date='2024-12-25'},(p)=>{p.oldParent.cleared=true},
  (p)=>{p.oldParent.subtransactions[0].amount=-400000},(p)=>{p.retainedParent.subtransactions[1].category='other'},
  (p)=>{p.retainedParent.subtransactions[1].category='food'},(p)=>{p.oldParent.imported_id='gmail:source'},
  (p)=>{p.oldParent.subtransactions[0].notes='https://example.com/receipt'},(p)=>{p.oldParent.subtransactions[0].cleared=true},
  (p,s)=>{s.transactions.push({...structuredClone(p.oldParent),id:'third'})},
  (p,s)=>{s.transactions[1].notes='changed'},
  (p,s,l)=>{l.records={x:{transactionId:'retained'}}},
  (p,s,l)=>{l.cashflows={x:{id:'olda'}}},
  (p,s,l)=>{l.historicalExpenseAmountCorrections={old:{verifiedAt:'2026-01-01',candidate:{oldTransaction:{id:'old'}}}}},
 ].entries()){const {p,s,l}=fixture();m(p,s,l);assert.throws(()=>classifyTwinSplitDedup(p,s,l),`unsafe case ${index}`);}
});
test('backs up and persists pending before deletion, verifies and retries without writing',async()=>{
 const {p,s,l}=fixture();let live=structuredClone(s),state=structuredClone(l),events=[];
 const api={async shutdown(){},async sync(){},async deleteTransaction(id){events.push('delete');assert.equal(state.historicalTwinSplitDeduplications.old.status,'pending');live.transactions=live.transactions.filter(x=>x.id!==id);live.balances.a-=p.oldParent.amount}};
 const d={async requireRun(){return structuredClone(state)},async readState(){return structuredClone(state)},async connect(){return{api}},async snapshot(){return structuredClone(live)},async backup(){events.push('backup');return '/backup'},async json(){},async save(x){state=structuredClone(x)}};
 assert.equal((await retireTwinSplitDedup(p,true,d)).verified,true);assert.equal((await retireTwinSplitDedup(p,true,d)).action,'existing');assert.deepEqual(events,['backup','delete']);assert.deepEqual(live.transactions[0],p.retainedParent);
});
test('interrupted deletion remains pending and retries fail closed',async()=>{
 const {p,s,l}=fixture();let live=structuredClone(s),state=structuredClone(l),deletes=0;
 const api={async shutdown(){},async sync(){},async deleteTransaction(){deletes++;throw Error('interrupted')}};
 const d={async requireRun(){return structuredClone(state)},async connect(){return{api}},async snapshot(){return structuredClone(live)},async backup(){return '/backup'},async json(){},async save(x){state=structuredClone(x)}};
 await assert.rejects(retireTwinSplitDedup(p,true,d),/interrupted/);assert.equal(state.historicalTwinSplitDeduplications.old.status,'pending');await assert.rejects(retireTwinSplitDedup(p,true,d),/pending/i);assert.equal(deletes,1);
});
test('unrelated readback change leaves pending audit and cannot be marked complete',async()=>{
 const {p,s,l}=fixture();let live=structuredClone(s),state=structuredClone(l);
 const api={async shutdown(){},async sync(){},async deleteTransaction(id){live.transactions=live.transactions.filter(x=>x.id!==id);live.balances.a-=p.oldParent.amount;live.transactions[0].notes='unexpected'}};
 const d={async requireRun(){return structuredClone(state)},async connect(){return{api}},async snapshot(){return structuredClone(live)},async backup(){return '/backup'},async json(){},async save(x){state=structuredClone(x)}};
 await assert.rejects(retireTwinSplitDedup(p,true,d),/Unrelated transaction changed/);assert.equal(state.historicalTwinSplitDeduplications.old.status,'pending');
});
