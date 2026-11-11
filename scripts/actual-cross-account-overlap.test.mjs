import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCrossAccountOverlap,retireCrossAccountOverlap} from './actual-cross-account-overlap.mjs';

const gross={id:'gross',account:'old',amount:-6653300,date:'2022-05-30',category:'grocery',payee:null,imported_id:'bank:gross',notes:'order 123 purchase ref1 refund ref2',cleared:true,reconciled:false,subtransactions:[]};
const net={id:'net',account:'new',amount:-6632600,date:'2022-06-01',category:'grocery',payee:'shop',imported_id:null,notes:'order 123 refund ref2',cleared:true,reconciled:false,subtransactions:[]};
const p={crossAccountRefundOverlap:true,currency:'CLP',migrationHash:'a'.repeat(64),gross,net,refundAmount:20700,refundDate:'2022-06-02',purchaseReference:'ref1',refundReference:'ref2',orderId:'123',statementFileId:'statement123',messageIds:['aaaa1111','bbbb2222','cccc3333'],evidence:'Verified full statement, refund and three distinct order messages.'};
const s={accounts:[{id:'old',closed:false},{id:'new',closed:false}],transactions:[gross,net],balances:{old:-6653300,new:-6632600},rules:[],schedules:[],categories:[],payees:[],dashboards:[]};
const l={historicalAccountMigrations:{['a'.repeat(64)]:{status:'complete',planHash:'a'.repeat(64),backup:'/backup',verifiedAt:'now',candidate:{sourceAccount:'old',destinationAccount:'new',excluded:[gross]}}}};
const copy=x=>structuredClone(x);

test('plans removal of the gross only when the exact migrated exception and refund are proven',()=>{
 const out=classifyCrossAccountOverlap(copy(p),copy(s),copy(l));
 assert.equal(out.action,'retire');assert.equal(out.grossId,'gross');assert.equal(out.netId,'net');assert.equal(out.balanceDelta,6653300);assert.match(out.planHash,/^[a-f0-9]{64}$/);
});

test('refuses a mismatch, duplicate refund, source ownership or incomplete migration',()=>{
 for(const change of [
  (p,s,l)=>{p.refundAmount=20600},
  (p,s,l)=>{s.transactions.push({id:'refund',account:'new',amount:20700,date:'2022-06-02',notes:'refund ref2',subtransactions:[]})},
  (p,s,l)=>{l.records={source:{transactionId:'gross'}}},
  (p,s,l)=>{l.historicalAccountMigrations[p.migrationHash].status='pending'},
  (p,s,l)=>{s.transactions[1].notes='changed'},
  (p,s,l)=>{p.messageIds[2]=p.messageIds[1]},
  (p,s,l)=>{s.transactions.push({id:'refund',account:'old',amount:20700,date:'2022-06-02',notes:'refund without reference',subtransactions:[]})},
  (p,s,l)=>{l.unrelatedAudits={entry:{transactionId:'gross'}}},
 ]){const a=copy(p),b=copy(s),c=copy(l);change(a,b,c);assert.throws(()=>classifyCrossAccountOverlap(a,b,c));}
});

function harness({interrupt=false,concurrent=false,corrupt=false}={}){
 let live=copy(s),ledger=copy(l),events=[];
 const api={async shutdown(){},async sync(){},async deleteTransaction(id){events.push('delete');live.transactions=live.transactions.filter(t=>t.id!==id);live.balances.old+=6653300;if(corrupt)live.transactions.find(t=>t.id==='net').notes='changed';if(interrupt)throw Error('interrupted')}};
 const d={async connect(){return {api}},async snapshot(){const x=copy(live);delete x.dashboards;return x},async readDashboard(){return copy(live.dashboards)},async readState(){return copy(ledger)},async requireRun(){return copy(ledger)},async backup(){events.push('backup');if(concurrent)live.transactions.find(t=>t.id==='net').notes='changed';return '/backup'},async json(){},async save(x){ledger=copy(x);events.push('audit:'+Object.values(ledger.crossAccountRefundOverlaps??{})[0]?.status)}};
 return {d,events,get live(){return live},get ledger(){return ledger}};
}
test('backs up and verifies a gross retirement; an exact retry is read-only',async()=>{
 const h=harness(),before=copy(h.live),plan=await retireCrossAccountOverlap(copy(p),false,h.d);h.d.expectedPlan=plan.planHash;
 const result=await retireCrossAccountOverlap(copy(p),true,h.d);assert.equal(result.verified,true);assert.deepEqual(h.events,['backup','audit:pending','delete','audit:complete']);
 assert(!h.live.transactions.some(t=>t.id==='gross'));assert.deepEqual(h.live.transactions.find(t=>t.id==='net'),before.transactions.find(t=>t.id==='net'));assert.equal(h.live.balances.old,0);
 const n=h.events.length;assert((await retireCrossAccountOverlap(copy(p),true,h.d)).verified);assert.equal(h.events.length,n);
});
test('interruption and readback mismatch retain pending intent; concurrent changes prevent deletion',async()=>{
 for(const options of [{interrupt:true},{corrupt:true},{concurrent:true}]){const h=harness(options),plan=await retireCrossAccountOverlap(copy(p),false,h.d);h.d.expectedPlan=plan.planHash;await assert.rejects(retireCrossAccountOverlap(copy(p),true,h.d));if(options.concurrent){assert(!h.events.includes('delete'));assert(!h.ledger.crossAccountRefundOverlaps)}else{assert.equal(Object.values(h.ledger.crossAccountRefundOverlaps)[0].status,'pending');const n=h.events.length;await assert.rejects(retireCrossAccountOverlap(copy(p),true,h.d),/pending/i);assert.equal(h.events.length,n)}}
});
