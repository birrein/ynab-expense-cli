import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyInstallmentTotal, retireInstallmentTotal} from './actual-installment-total-dedup.mjs';

const transaction=(id,date,amount,notes)=>({id,account:'card',date,amount,payee:'shop',category:'cat',notes,imported_id:null,transfer_id:null,is_parent:false,is_child:false,parent_id:null,subtransactions:[],reconciled:false,schedule:null});
const total=transaction('total','2025-03-01',-60000,'Purchase 3cpc #cuotas');
const entries=[1,2,3].map(n=>({number:n,statementId:`statement-${n}`,statementDate:`2025-0${n+2}-19`,statementAmount:-20000,transaction:transaction(`part-${n}`,`2025-0${n+2}-19`,-20000,`Purchase ${n}/3 #cuotas`)}));
const candidate={installmentTotalRetirement:true,currency:'CLP',total,installments:entries,purchaseMessageId:'1234567890abcdef',evidence:'Three monthly statements and a unique matching merchant receipt.'};
const snapshot={accounts:[{id:'card'}],transactions:[total,...entries.map(x=>x.transaction)],balances:{card:-120000},categories:[],payees:[],rules:[],schedules:[]};

test('plans an exact complete historical series',()=>assert.equal(classifyInstallmentTotal(candidate,snapshot,{}).action,'retire'));
test('refuses missing, repeated, altered, misdated, unbacked or owned installments',()=>{
 for(const mutate of [
  q=>q.installments.pop(),q=>q.installments[1].number=1,q=>q.installments[1].statementId=q.installments[0].statementId,
  q=>q.installments[0].statementAmount--,q=>q.installments[0].statementDate='2025-04-19',q=>q.installments[0].transaction.notes='wrong',
  q=>q.total.amount--,q=>q.purchaseMessageId='',q=>q.evidence='',q=>q.installments[0].transaction.payee='different',
  q=>q.installments[0].transaction.reconciled=true,q=>q.installments[0].transaction.id=q.total.id,
 ]){let q=structuredClone(candidate);mutate(q);assert.throws(()=>classifyInstallmentTotal(q,snapshot,{}));}
 assert.throws(()=>classifyInstallmentTotal(candidate,snapshot,{records:{x:{transactionId:'part-1'}}}));
 assert.throws(()=>classifyInstallmentTotal(candidate,snapshot,{cashflows:{x:{id:'total'}}}));
});
test('backups before deletion, preserves series, audits and retries without another write',async()=>{
 let live=structuredClone(snapshot),ledger={},events=[];
 const api={async sync(){},async shutdown(){},async deleteTransaction(id){events.push('delete');live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.card+=60000;}};
 const d={async connect(){return {api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){events.push('backup');return '/backup'},async json(){},async save(s){ledger=s}};
 assert.equal((await retireInstallmentTotal(candidate,false,d)).action,'retire');assert.deepEqual(events,[]);
 assert((await retireInstallmentTotal(candidate,true,d)).verified);assert.deepEqual(events,['backup','delete']);
 assert((await retireInstallmentTotal(candidate,true,d)).verified);assert.deepEqual(events,['backup','delete']);
 delete ledger.installmentTotalRetirements.total;await assert.rejects(()=>retireInstallmentTotal(candidate,true,d));
});
test('requires an owned lease before opening the financial budget',async()=>{
 let connected=false;
 const d={async requireRun(){throw Error('lease missing')},async connect(){connected=true;throw Error('must not connect')}};
 await assert.rejects(()=>retireInstallmentTotal(candidate,true,d),/lease missing/);assert.equal(connected,false);
});
test('detects unrelated changes on independent readback and does not save an audit',async()=>{
 let live=structuredClone(snapshot),saved=false;
 const api={async sync(){},async shutdown(){},async deleteTransaction(id){live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.card+=60000;live.transactions[0].notes='unexpected change'}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return{}},async backup(){return'/backup'},async json(){},async save(){saved=true}};
 await assert.rejects(()=>retireInstallmentTotal(candidate,true,d),/Other transaction changed/);assert.equal(saved,false);
});
test('plans financed total only with the exact positive stated finance cost',()=>{
 const q=structuredClone(candidate);q.financeCost=3000;q.installments.forEach(e=>{e.statementAmount=-21000;e.transaction.amount=-21000});
 const s=structuredClone(snapshot);s.transactions=[q.total,...q.installments.map(e=>e.transaction)];
 assert.equal(classifyInstallmentTotal(q,s,{}).action,'retire');
 for(const value of [undefined,0,-3000,2999,3001,1.5,'3000']){const v=structuredClone(q);if(value===undefined)delete v.financeCost;else v.financeCost=value;assert.throws(()=>classifyInstallmentTotal(v,s,{}));}
});
test('financed total retirement retains installments and audits retries',async()=>{
 const q=structuredClone(candidate);q.financeCost=3000;q.installments.forEach(e=>{e.statementAmount=-21000;e.transaction.amount=-21000});
 let live=structuredClone(snapshot);live.transactions=[q.total,...q.installments.map(e=>e.transaction)];live.balances.card=-123000;let ledger={},events=[];
 const api={async sync(){},async shutdown(){},async deleteTransaction(id){events.push(id);live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.card+=60000}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){return'/backup'},async json(){},async save(x){ledger=x}};
 assert((await retireInstallmentTotal(q,true,d)).verified);assert((await retireInstallmentTotal(q,true,d)).verified);assert.deepEqual(events,['total']);assert.deepEqual(live.transactions,q.installments.map(e=>e.transaction));assert.equal(ledger.installmentTotalRetirements.total.candidate.financeCost,3000);
});
