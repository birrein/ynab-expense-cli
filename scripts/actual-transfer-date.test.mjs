import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTransferDate,correctTransferDate} from './actual-transfer-date.mjs';

const row=(id,account,amount,payee,transfer_id,cleared)=>({id,account,amount,payee,transfer_id,cleared,date:'2024-06-05',category:null,notes:null,imported_id:null,reconciled:false,is_parent:false,is_child:false,parent_id:null,subtransactions:[],schedule:null});
const oldOrigin=row('o','a',-4000000,'pb','d',false),oldDestination=row('d','b',4000000,'pa','o',true);
const candidate={historicalTransferDateCorrection:true,currency:'CLP',oldOrigin,oldDestination,newDate:'2024-06-04',receiptId:'18fe3ec88f5aafb2',statementFileId:'statement123',evidence:'Receipt and both statement accounts independently identify this transfer.'};
const snapshot={accounts:[{id:'a'},{id:'b'}],payees:[{id:'pa',transfer_acct:'a'},{id:'pb',transfer_acct:'b'}],categories:[],rules:[],schedules:[],balances:{a:-4000000,b:4000000},transactions:[oldOrigin,oldDestination]};
test('plans the evidenced one-day correction with different cleared states',()=>assert.equal(classifyTransferDate(candidate,snapshot,{}).action,'correct'));
test('rejects changed legs, duplicate candidates, sources and pending audit',()=>{for(const f of [p=>p.oldDestination.cleared=false,p=>p.newDate='2024-06-02',p=>p.receiptId='bad',p=>p.oldOrigin.amount--,p=>p.evidence='']){const p=structuredClone(candidate);f(p);assert.throws(()=>classifyTransferDate(p,snapshot,{}));}const s=structuredClone(snapshot);s.transactions.push({...oldOrigin,id:'extra',date:'2024-06-04'});assert.throws(()=>classifyTransferDate(candidate,s,{}));assert.throws(()=>classifyTransferDate(candidate,snapshot,{transferDateCorrections:{o:{status:'pending'}}}));});
function harness(failAt=0){let live=structuredClone(snapshot),ledger={},events=[],n=0;const api={async sync(){},async shutdown(){},async updateTransaction(id,changes){events.push('update:'+id);if(++n===failAt)throw Error('interrupted');Object.assign(live.transactions.find(x=>x.id===id),changes)}};return{events,get live(){return live},get ledger(){return ledger},d:{async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){events.push('backup');return '/backup'},async json(){},async save(x){ledger=structuredClone(x);events.push('audit:'+ledger.transferDateCorrections?.o?.status)}}};}
test('changes exactly two dates and preserves clearing, balances and idempotency',async()=>{const h=harness(),r=await correctTransferDate(candidate,true,h.d);assert(r.verified);assert.deepEqual(h.live.transactions,snapshot.transactions.map(t=>({...t,date:'2024-06-04'})));assert.deepEqual(h.live.balances,snapshot.balances);assert(h.events.indexOf('audit:pending')<h.events.indexOf('update:o'));const n=h.events.length;assert((await correctTransferDate(candidate,true,h.d)).verified);assert.equal(h.events.length,n)});
test('interruption blocks all further automatic updates',async()=>{const h=harness(2);await assert.rejects(()=>correctTransferDate(candidate,true,h.d),/interrupted/);assert.equal(h.ledger.transferDateCorrections.o.status,'pending');const n=h.events.length;await assert.rejects(()=>correctTransferDate(candidate,true,h.d),/Pending/);assert.equal(h.events.length,n)});

function postingFixture(){
 const p=structuredClone(candidate);p.oldOrigin.date='2024-07-01';p.oldDestination.date='2024-07-01';p.newDate='2024-06-29';p.postingDateEvidence={originStatementId:'checking_statement_123',postingDate:'2024-07-01'};
 const s=structuredClone(snapshot);s.transactions=[structuredClone(p.oldOrigin),structuredClone(p.oldDestination)];return {p,s};
}
test('plans cross-month correction supported by receipt and distinct bank statements',()=>{const {p,s}=postingFixture();assert.equal(classifyTransferDate(p,s,{}).action,'correct')});
test('accepts a fully evidenced four-day cross-month posting delay',()=>{const {p,s}=postingFixture();p.oldOrigin.date=p.oldDestination.date='2024-11-04';p.newDate='2024-10-31';p.postingDateEvidence.postingDate='2024-11-04';s.transactions=[structuredClone(p.oldOrigin),structuredClone(p.oldDestination)];assert.equal(classifyTransferDate(p,s,{}).action,'correct')});
test('rejects bad cross-month posting evidence and unbounded or ambiguous dates',()=>{
 for(const mutate of [p=>p.postingDateEvidence.originStatementId=p.statementFileId,p=>p.postingDateEvidence.originStatementId='bad',p=>p.postingDateEvidence.postingDate='2024-06-30',p=>p.postingDateEvidence.extra=true,p=>p.newDate='2024-06-26',p=>p.newDate='2024-07-02',p=>p.newDate='2024-07-01',p=>p.newDate='2024-07-02',p=>p.receiptId='bad']){
  const {p,s}=postingFixture();mutate(p);assert.throws(()=>classifyTransferDate(p,s,{}));
 }
 const {p,s}=postingFixture();s.transactions.push({...p.oldOrigin,id:'duplicate',date:'2024-06-29'});assert.throws(()=>classifyTransferDate(p,s,{}));
});
test('cross-month correction preserves the pair and completed retry is read-only',async()=>{
 const {p,s}=postingFixture();let live=structuredClone(s),ledger={},events=[];const api={async sync(){},async shutdown(){},async updateTransaction(id,changes){events.push('write');Object.assign(live.transactions.find(t=>t.id===id),changes)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){events.push('backup');return '/backup'},async json(){},async save(x){ledger=structuredClone(x)}};
 assert((await correctTransferDate(p,true,d)).verified);assert.deepEqual(live.transactions,s.transactions.map(t=>({...t,date:p.newDate})));assert.deepEqual(live.balances,s.balances);assert((await correctTransferDate(p,true,d)).verified);assert.deepEqual(events,['backup','write','write']);
});

function sameMonthFixture(){
 const p=structuredClone(candidate);p.oldOrigin.date=p.oldDestination.date='2024-06-07';p.newDate='2024-06-05';p.sameMonthEvidence={receiptDate:'2024-06-05',statementDate:'2024-06-05'};
 const s=structuredClone(snapshot);s.transactions=[structuredClone(p.oldOrigin),structuredClone(p.oldDestination)];return {p,s};
}
test('plans same-month delay with agreeing destination receipt and origin statement',()=>{const {p,s}=sameMonthFixture();assert.equal(classifyTransferDate(p,s,{}).action,'correct')});
test('rejects conflicting same-month evidence, insufficient gaps and mixed evidence modes',()=>{
 for(const mutate of [p=>p.sameMonthEvidence.receiptDate='2024-06-04',p=>p.sameMonthEvidence.statementDate='2024-06-04',p=>p.sameMonthEvidence.extra=true,p=>p.newDate='2024-06-02',p=>p.newDate='2024-07-01',p=>p.newDate='2024-06-08',p=>p.newDate='2024-06-06',p=>p.postingDateEvidence={originStatementId:'other_statement_123',postingDate:p.oldOrigin.date}]){const {p,s}=sameMonthFixture();mutate(p);assert.throws(()=>classifyTransferDate(p,s,{}))}
 const {p,s}=sameMonthFixture();s.transactions.push({...p.oldOrigin,id:'competing',date:p.newDate});assert.throws(()=>classifyTransferDate(p,s,{}));
});
test('same-month correction preserves data and repeat is read-only',async()=>{
 const {p,s}=sameMonthFixture();let live=structuredClone(s),ledger={},events=[];const api={async sync(){},async shutdown(){},async updateTransaction(id,changes){events.push('write');Object.assign(live.transactions.find(t=>t.id===id),changes)}};
 const d={async connect(){return{api}},async snapshot(){return structuredClone(live)},async requireRun(){return structuredClone(ledger)},async readState(){return structuredClone(ledger)},async backup(){events.push('backup');return '/backup'},async json(){},async save(x){ledger=structuredClone(x)}};
 assert((await correctTransferDate(p,true,d)).verified);assert.deepEqual(live.transactions,s.transactions.map(t=>({...t,date:p.newDate})));assert.deepEqual(live.balances,s.balances);assert((await correctTransferDate(p,true,d)).verified);assert.deepEqual(events,['backup','write','write']);
});
