import test from 'node:test';import assert from 'node:assert/strict';import {classifyAggregateDedup,retireAggregateDedup} from './actual-aggregate-dedup.mjs';
const comp=(id,amount)=>({id,account:'a',date:'2021-05-11',amount,payee:'mily',category:'cat',notes:id,imported_id:id,transfer_id:null});
const p={aggregateDuplicateRetirement:true,currency:'CLP',aggregateId:'agg',sourceId:'bank:abc',account:'a',date:'2021-05-11',amount:-23400,payee:'mily',components:[comp('one',-18000),comp('two',-5400)],statementFileId:'statement123',evidence:'One transfer represented by the two component rows.'};
const s={accounts:[{id:'a'}],categories:[],payees:[],rules:[],schedules:[],balances:{a:-46800},transactions:[{id:'agg',account:'a',date:p.date,amount:p.amount,payee:'mily',imported_id:p.sourceId},...p.components]};
const init=()=>({cashflows:{[p.sourceId]:{id:'agg',account:'a',amount:p.amount,date:p.date,type:'expense'}}});
test('plans exact duplicate aggregate',()=>assert.equal(classifyAggregateDedup(p,s,init()).action,'retire'));
test('rejects altered components, source and sum',()=>{for(const f of [x=>x.components[0].amount--,x=>x.components.pop(),x=>x.sourceId='bank:other',x=>x.evidence='',x=>x.payee='other']){let q=structuredClone(p);f(q);assert.throws(()=>classifyAggregateDedup(q,s,init()))}});
test('backs up, retires aggregate and audits retry',async()=>{let live=structuredClone(s),ledger=init(),events=[];const api={async sync(){},async shutdown(){},async deleteTransaction(id){events.push('delete');live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.a+=23400}};const d={async connect(){return {api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){events.push('backup');return '/backup'},async json(){},async save(x){ledger=x}};let r=await retireAggregateDedup(p,true,d);assert(r.verified);assert.equal(ledger.cashflows[p.sourceId].status,'superseded-duplicate');assert.deepEqual(events,['backup','delete']);r=await retireAggregateDedup(p,true,d);assert(r.verified);assert.deepEqual(events,['backup','delete'])});
test('superseded source never reaches a financial writer',async()=>{const {cashflow}=await import('./actual-cashflow.mjs');let touched=false;const ctx={budgets:{CLP:{}},async readState(){return {cashflows:{'bank:abc':{status:'superseded-duplicate'}}}},async requireRun(){return {cashflows:{'bank:abc':{status:'superseded-duplicate'}}}},async connect(){touched=true;throw Error('must not connect')}};for(const commit of [false,true]){let r=await cashflow({currency:'CLP',sourceId:'bank:abc'},commit,ctx);assert.equal(r.action,'review');assert.match(r.reason,/superseded/i)}assert.equal(touched,false)});
test('historical aggregate requires exact identity and individually verified ledger components',()=>{
 const q={...structuredClone(p),sourceId:'agg',historicalAggregate:{category:'cat',notes:'interest total',imported_id:null}};
 const z=structuredClone(s);Object.assign(z.transactions[0],{category:'cat',notes:'interest total',imported_id:null});
 const ledger={cashflows:{one:{id:'one',type:'expense',account:'a',date:q.date,amount:-18000},two:{id:'two',type:'expense',account:'a',date:q.date,amount:-5400}}};
 assert.equal(classifyAggregateDedup(q,z,ledger).action,'retire');
 for(const change of [x=>x.historicalAggregate.notes='wrong',x=>x.components[0].imported_id='other',x=>x.sourceId='wrong']){const x=structuredClone(q);change(x);assert.throws(()=>classifyAggregateDedup(x,z,ledger))}
 assert.throws(()=>classifyAggregateDedup(q,z,{cashflows:{one:ledger.cashflows.one}}));
 assert.throws(()=>classifyAggregateDedup(q,z,{...ledger,records:{x:{transactionId:'agg'}}}));
});
test('historical aggregate retire preserves each component ledger entry and audits idempotently',async()=>{
 const q={...structuredClone(p),sourceId:'agg',historicalAggregate:{category:'cat',notes:'interest total',imported_id:null}};let live=structuredClone(s);Object.assign(live.transactions[0],{category:'cat',notes:'interest total',imported_id:null});
 let ledger={cashflows:{one:{id:'one',type:'expense',account:'a',date:q.date,amount:-18000},two:{id:'two',type:'expense',account:'a',date:q.date,amount:-5400}}};let events=[];
 const api={async sync(){},async shutdown(){},async deleteTransaction(id){events.push(id);live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.a+=23400}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){return'/backup'},async json(){},async save(x){ledger=x}};
 assert((await retireAggregateDedup(q,true,d)).verified);assert.equal(ledger.cashflows.one.id,'one');assert.equal(ledger.cashflows.two.id,'two');assert((await retireAggregateDedup(q,true,d)).verified);assert.deepEqual(events,['agg']);
});
test('itemized aggregate supports exactly one day later statement date only with receipt evidence',()=>{
 const q={...structuredClone(p),componentDateEvidence:{receiptDate:'2021-05-10',receiptMessageId:'abcdef1234567890'}};
 q.components.forEach(x=>x.date='2021-05-10');const z=structuredClone(s);z.transactions.filter(t=>t.id!=='agg').forEach(t=>t.date='2021-05-10');
 assert.equal(classifyAggregateDedup(q,z,init()).action,'retire');
 for(const v of [{receiptDate:'2021-05-09',receiptMessageId:'abcdef1234567890'},{receiptDate:'2021-05-10',receiptMessageId:''}])assert.throws(()=>classifyAggregateDedup({...q,componentDateEvidence:v},z,init()));
 assert.throws(()=>classifyAggregateDedup({...q,componentDateEvidence:undefined},z,init()));
});
test('historical bank issuer alias requires exact allowed payee names and same category',()=>{
 const q={...structuredClone(p),sourceId:'agg',historicalAggregate:{category:'cat',notes:null,imported_id:null},historicalIssuerAlias:{aggregatePayee:'old',historicalName:'Falabella',componentName:'Banco Falabella'}};
 const z=structuredClone(s);z.payees=[{id:'old',name:'Falabella'},{id:'mily',name:'Banco Falabella'}];Object.assign(z.transactions[0],{payee:'old',category:'cat',notes:null,imported_id:null});
 const ledger={cashflows:{one:{id:'one',type:'expense',account:'a',date:q.date,amount:-18000},two:{id:'two',type:'expense',account:'a',date:q.date,amount:-5400}}};
 assert.equal(classifyAggregateDedup(q,z,ledger).action,'retire');
 for(const change of [x=>x.historicalIssuerAlias.aggregatePayee='mily',x=>x.historicalIssuerAlias.historicalName='Other',x=>x.historicalIssuerAlias.componentName='Other',x=>x.components[0].category='other',x=>delete x.historicalAggregate]){const x=structuredClone(q);change(x);assert.throws(()=>classifyAggregateDedup(x,z,ledger));}
 const bad=structuredClone(z);bad.payees[0].name='Other';assert.throws(()=>classifyAggregateDedup(q,bad,ledger));
 assert.throws(()=>classifyAggregateDedup(q,z,{...ledger,records:{x:{transactionId:'agg'}}}));
});
test('issuer alias retirement preserves components and retries idempotently',async()=>{
 const q={...structuredClone(p),sourceId:'agg',historicalAggregate:{category:'cat',notes:null,imported_id:null},historicalIssuerAlias:{aggregatePayee:'old',historicalName:'Falabella',componentName:'Banco Falabella'}};
 let live=structuredClone(s);live.payees=[{id:'old',name:'Falabella'},{id:'mily',name:'Banco Falabella'}];Object.assign(live.transactions[0],{payee:'old',category:'cat',notes:null,imported_id:null});
 let ledger={cashflows:{one:{id:'one',type:'expense',account:'a',date:q.date,amount:-18000},two:{id:'two',type:'expense',account:'a',date:q.date,amount:-5400}}},events=[];
 const api={async sync(){},async shutdown(){},async deleteTransaction(id){events.push(id);live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.a+=23400}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){return'/backup'},async json(){},async save(x){ledger=x}};
 assert((await retireAggregateDedup(q,true,d)).verified);assert((await retireAggregateDedup(q,true,d)).verified);assert.deepEqual(events,['agg']);assert.equal(ledger.cashflows.one.id,'one');assert.equal(ledger.cashflows.two.id,'two');
});
