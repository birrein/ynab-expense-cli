import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPostingDates, correctPostingDates} from './actual-transfer-posting-dates.mjs';

const origin={id:'origin',account:'checking',date:'2024-12-02',amount:-150000000,payee:'to-card',transfer_id:'destination',notes:null};
const destination={id:'destination',account:'card',date:'2024-12-02',amount:150000000,payee:'to-checking',transfer_id:'origin',notes:null};
const candidate={historicalTransferPostingDates:true,currency:'CLP',oldOrigin:origin,oldDestination:destination,originDate:'2024-12-02',destinationDate:'2024-11-29',receiptId:'1937a3c1ebc45fa3',originStatementId:'checking-statement',destinationStatementId:'card-statement',evidence:'The receipt and both statements uniquely establish the payment and different posting dates.'};
const snapshot={accounts:[{id:'checking'},{id:'card'}],payees:[{id:'to-card',transfer_acct:'card'},{id:'to-checking',transfer_acct:'checking'}],transactions:[origin,destination],balances:{checking:-150000000,card:150000000},categories:[],rules:[],schedules:[]};
const copy=x=>structuredClone(x);
function harness(fail=false,initial={},initialSnapshot=snapshot){let live=copy(initialSnapshot),ledger=copy(initial),events=[],writes=0;const api={async sync(){},async shutdown(){},async updateTransaction(id,changes){events.push('write');writes++;if(fail===true||fail===writes)throw Error('interrupted');Object.assign(live.transactions.find(t=>t.id===id),changes)}};return{events,get live(){return live},get ledger(){return ledger},d:{async connect(){return{api}},async snapshot(){return copy(live)},async readState(){return copy(ledger)},async requireRun(){return copy(ledger)},async save(x){ledger=copy(x);events.push('audit:'+ledger.transferPostingDateCorrections?.origin?.status)},async backup(){events.push('backup');return '/backup'},async json(){}}};}
test('previews a single leg correction with an immutable full-state hash',()=>{const p=classifyPostingDates(candidate,snapshot,{});assert.equal(p.action,'correct');assert.equal(p.changedId,'destination');assert.deepEqual(p.dailyImpact,[{account:'card',date:'2024-11-29',delta:150000000},{account:'card',date:'2024-11-30',delta:150000000},{account:'card',date:'2024-12-01',delta:150000000}]);assert.match(p.planHash,/^[a-f0-9]{64}$/);const s=copy(snapshot);s.accounts[0].name='changed';assert.notEqual(classifyPostingDates(candidate,s,{}).planHash,p.planHash)});
test('rejects unsupported evidence, unexpected snapshots, competing transfers and owned sources',()=>{for(const mutate of [p=>p.originStatementId=p.destinationStatementId,p=>p.destinationDate='2024-11-20',p=>p.receiptId='bad',p=>p.originDate='2024-12-01',p=>p.oldOrigin.amount=-3,p=>p.oldDestination.reconciled=true]){const p=copy(candidate);mutate(p);assert.throws(()=>classifyPostingDates(p,snapshot,{}))}let s=copy(snapshot);s.transactions.push({...origin,id:'competitor',transfer_id:'other'});assert.throws(()=>classifyPostingDates(candidate,s,{}));assert.throws(()=>classifyPostingDates(candidate,snapshot,{records:{x:{transactionId:'destination'}}}));});
test('backs up and records intent before one write, verifies and retries read only',async()=>{let h=harness();let plan=await correctPostingDates(candidate,false,h.d);h.d.expectedPlan=plan.planHash;let done=await correctPostingDates(candidate,true,h.d);assert(done.verified);assert.equal(h.live.transactions[1].date,'2024-11-29');assert.equal(h.live.transactions[0].date,'2024-12-02');assert.deepEqual(h.live.balances,snapshot.balances);assert(h.events.indexOf('audit:pending')<h.events.indexOf('write'));let n=h.events.length;assert.equal((await correctPostingDates(candidate,true,h.d)).action,'existing');assert.equal(h.events.length,n)});
test('interrupted write remains pending and rejects retry',async()=>{let h=harness(true);h.d.expectedPlan=(await correctPostingDates(candidate,false,h.d)).planHash;await assert.rejects(correctPostingDates(candidate,true,h.d),/interrupted/);assert.equal(h.ledger.transferPostingDateCorrections.origin.status,'pending');await assert.rejects(correctPostingDates(candidate,true,h.d),/Pending/)});
test('rejects a stale plan before backup and writing',async()=>{let h=harness();h.d.expectedPlan='stale';await assert.rejects(correctPostingDates(candidate,true,h.d),/Plan digest changed/);assert.deepEqual(h.events,[])});
function commonDateCandidate(){const p=copy(candidate);p.originDate=p.destinationDate='2024-12-05';p.bothStatementPostingDate={receiptDate:'2024-12-02',originStatementDate:'2024-12-05',destinationStatementDate:'2024-12-05'};return p}
function earlierReceiptCandidate(){const p=commonDateCandidate();p.receiptBeforeHistorical=true;p.bothStatementPostingDate.receiptDate='2024-12-01';return p}
test('accepts one-day earlier receipt only with bounded common posting and no competitors',()=>{
 const p=earlierReceiptCandidate();assert.equal(classifyPostingDates(p,snapshot,{}).action,'correct');
 for(const change of [x=>x.receiptBeforeHistorical=false,x=>delete x.bothStatementPostingDate,x=>x.bothStatementPostingDate.receiptDate='2024-11-30',x=>x.bothStatementPostingDate.receiptDate='2024-12-02',x=>x.originDate=x.destinationDate='2024-12-06',x=>x.historicalDateUnreliable=true,x=>x.priorTransferDateCorrection=true,x=>x.distinctTransferPeers=[],x=>x.destinationReceiptEvidence={}]){let q=earlierReceiptCandidate();change(q);assert.throws(()=>classifyPostingDates(q,snapshot,{}))}
 const s=copy(snapshot);s.transactions.push({...origin,id:'competitor',date:'2024-11-27'});assert.throws(()=>classifyPostingDates(p,s,{}));
});
test('earlier receipt transfer preserves both legs and verifies retry without another write',async()=>{
 const p=earlierReceiptCandidate(),h=harness();h.d.expectedPlan=(await correctPostingDates(p,false,h.d)).planHash;assert((await correctPostingDates(p,true,h.d)).verified);assert.deepEqual(h.live.transactions.map(t=>t.date),['2024-12-05','2024-12-05']);const n=h.events.length;assert((await correctPostingDates(p,true,h.d)).verified);assert.equal(h.events.length,n);
});
test('previews and verifies both independently evidenced later dates',async()=>{const p=commonDateCandidate(),h=harness();const plan=await correctPostingDates(p,false,h.d);assert.deepEqual(plan.changedIds,['origin','destination']);assert.equal(plan.dailyImpact.length,6);h.d.expectedPlan=plan.planHash;assert((await correctPostingDates(p,true,h.d)).verified);assert.deepEqual(h.live.transactions.map(t=>t.date),['2024-12-05','2024-12-05']);assert.equal(h.events.filter(x=>x==='write').length,2);assert((await correctPostingDates(p,true,h.d)).verified)});
test('rejects conflicting common posting evidence',()=>{for(const change of [p=>p.bothStatementPostingDate.receiptDate='2024-12-01',p=>p.bothStatementPostingDate.originStatementDate='2024-12-04',p=>p.destinationDate='2024-12-04',p=>p.originDate=p.destinationDate='2024-12-07',p=>p.originDate=p.destinationDate='2024-12-01',p=>p.bothStatementPostingDate.extra=true]){const p=commonDateCandidate();change(p);assert.throws(()=>classifyPostingDates(p,snapshot,{}))}});
test('interruption after first leg preserves pending intent',async()=>{const p=commonDateCandidate(),h=harness(2);h.d.expectedPlan=(await correctPostingDates(p,false,h.d)).planHash;await assert.rejects(correctPostingDates(p,true,h.d),/interrupted/);assert.equal(h.ledger.transferPostingDateCorrections.origin.status,'pending');assert.equal(h.live.transactions[0].date,'2024-12-05');assert.equal(h.live.transactions[1].date,'2024-12-02');await assert.rejects(correctPostingDates(p,true,h.d),/Pending/)});

// A statement-backed correction may follow a completed operation-date correction.
const priorCandidate={historicalTransferDateCorrection:true,currency:'CLP',oldOrigin:{...origin,date:'2024-12-03'},oldDestination:{...destination,date:'2024-12-03'},newDate:'2024-12-02',receiptId:'1937a3c1ebc45fa3',statementFileId:'card-statement',evidence:'The original receipt and statements identify this payment uniquely.'};
const priorAudit={status:'complete',candidate:priorCandidate,backup:'/original-backup',verifiedAt:'2026-11-08T00:00:00Z'};
const linkedCandidate={...candidate,priorTransferDateCorrection:true};
const priorLedger=()=>({transferDateCorrections:{origin:copy(priorAudit)}});

test('requires an exact completed prior audit and explicit link',()=>{
 assert.equal(classifyPostingDates(linkedCandidate,snapshot,priorLedger()).action,'correct');
 assert.throws(()=>classifyPostingDates(candidate,snapshot,priorLedger()),/prior|audit/i);
 assert.throws(()=>classifyPostingDates(linkedCandidate,snapshot,{}),/prior|audit/i);
 let l=priorLedger();l.transferDateCorrections.origin.status='pending';assert.throws(()=>classifyPostingDates(linkedCandidate,snapshot,l),/prior|audit|pending/i);
 l=priorLedger();l.transferDateCorrections.origin.candidate.oldOrigin.amount--;assert.throws(()=>classifyPostingDates(linkedCandidate,snapshot,l),/prior|audit|differ/i);
});

test('old correction retry verifies only a completed exact linked successor',async()=>{
 const {classifyTransferDate}=await import('./actual-transfer-date.mjs');
 const after=copy(snapshot);after.transactions[1].date=linkedCandidate.destinationDate;
 const l=priorLedger();l.transferPostingDateCorrections={origin:{status:'complete',candidate:copy(linkedCandidate),planHash:'a'.repeat(64),backup:'/new-backup'}};
 assert.equal(classifyTransferDate(priorCandidate,after,l).action,'existing');
 l.transferPostingDateCorrections.origin.status='pending';assert.throws(()=>classifyTransferDate(priorCandidate,after,l),/pending|audit/i);
 l.transferPostingDateCorrections.origin.status='complete';l.transferPostingDateCorrections.origin.candidate.oldOrigin.amount--;assert.throws(()=>classifyTransferDate(priorCandidate,after,l));
});

test('linked application preserves the prior audit and both retries are read only',async()=>{
 const {classifyTransferDate}=await import('./actual-transfer-date.mjs');
 const h=harness(false,priorLedger());const plan=await correctPostingDates(linkedCandidate,false,h.d);h.d.expectedPlan=plan.planHash;
 assert((await correctPostingDates(linkedCandidate,true,h.d)).verified);
 assert.deepEqual(h.ledger.transferDateCorrections.origin,priorAudit);
 assert.equal(classifyTransferDate(priorCandidate,h.live,h.ledger).action,'existing');
 const count=h.events.length;assert((await correctPostingDates(linkedCandidate,true,h.d)).verified);assert.equal(h.events.length,count);
});

test('linked interruption retains the old audit and cannot be verified as complete',async()=>{
 const {classifyTransferDate}=await import('./actual-transfer-date.mjs');
 const h=harness(true,priorLedger());h.d.expectedPlan=(await correctPostingDates(linkedCandidate,false,h.d)).planHash;
 await assert.rejects(correctPostingDates(linkedCandidate,true,h.d),/interrupted/);
 assert.deepEqual(h.ledger.transferDateCorrections.origin,priorAudit);
 assert.throws(()=>classifyTransferDate(priorCandidate,h.live,h.ledger),/pending/i);
 await assert.rejects(correctPostingDates(linkedCandidate,true,h.d),/pending/i);
});

function peerFixture(){
 const peerOrigin={...origin,id:'peer-origin',account:'checking2',transfer_id:'peer-destination'};
 const peerDestination={...destination,id:'peer-destination',payee:'to-checking2',transfer_id:'peer-origin'};
 const peer={oldOrigin:peerOrigin,oldDestination:peerDestination,receiptId:'191b5c3b69e232e2',evidence:'A separate provider receipt identifies the other source and the same destination.'};
 const s=copy(snapshot);s.accounts.push({id:'checking2'});s.payees.push({id:'to-checking2',transfer_acct:'checking2'});s.transactions.push(peerOrigin,peerDestination);
 return {p:{...copy(candidate),distinctTransferPeers:[peer]},s,peer};
}
test('accepts only exact and complete independently identified competing transfer peers',()=>{
 const {p,s}=peerFixture();assert.equal(classifyPostingDates(p,s,{}).action,'correct');
 assert.throws(()=>classifyPostingDates(candidate,s,{}),/duplicate/i);
 for(const change of [x=>x.distinctTransferPeers=[],x=>x.distinctTransferPeers.push(copy(x.distinctTransferPeers[0])),x=>x.distinctTransferPeers[0].oldOrigin.amount--,x=>x.distinctTransferPeers[0].oldOrigin.account='checking',x=>x.distinctTransferPeers[0].oldDestination.transfer_id='other',x=>x.distinctTransferPeers[0].receiptId=x.receiptId,x=>x.distinctTransferPeers[0].evidence='short']){const x=copy(p);change(x);assert.throws(()=>classifyPostingDates(x,s,{}));}
 const extra=copy(s);extra.transactions.push({...p.distinctTransferPeers[0].oldDestination,id:'undeclared'});assert.throws(()=>classifyPostingDates(p,extra,{}));
});
test('peer transfer remains exact after apply and interruption or stale peers fail closed',async()=>{
 const {p,s,peer}=peerFixture();let h=harness(false,{},s);h.d.expectedPlan=(await correctPostingDates(p,false,h.d)).planHash;assert((await correctPostingDates(p,true,h.d)).verified);assert.deepEqual(h.live.transactions.slice(-2),[peer.oldOrigin,peer.oldDestination]);const n=h.events.length;assert((await correctPostingDates(p,true,h.d)).verified);assert.equal(h.events.length,n);
 h=harness(true,{},s);h.d.expectedPlan=(await correctPostingDates(p,false,h.d)).planHash;await assert.rejects(correctPostingDates(p,true,h.d),/interrupted/);assert.deepEqual(h.live.transactions.slice(-2),[peer.oldOrigin,peer.oldDestination]);assert.equal(h.ledger.transferPostingDateCorrections.origin.status,'pending');
});
function manuallyDatedTransfer(){const p=copy(candidate);p.oldOrigin.date=p.oldDestination.date='2024-12-24';p.originDate=p.destinationDate='2024-12-30';p.bothStatementPostingDate={receiptDate:'2024-12-30',originStatementDate:'2024-12-30',destinationStatementDate:'2024-12-30'};p.historicalDateUnreliable=true;const s=copy(snapshot);s.transactions=[copy(p.oldOrigin),copy(p.oldDestination)];return {p,s}}
test('supports only an explicitly evidenced manual transfer date with matching receipt and statements',async()=>{
 const {p,s}=manuallyDatedTransfer(),plan=classifyPostingDates(p,s,{});assert.deepEqual(plan.changedIds,['origin','destination']);assert.equal(plan.dailyImpact.length,12);
 for(const f of [x=>delete x.historicalDateUnreliable,x=>x.historicalDateUnreliable=false,x=>x.bothStatementPostingDate.receiptDate='2024-12-24',x=>x.originDate=x.destinationDate='2025-01-01',x=>x.bothStatementPostingDate.originStatementDate='2024-12-29',x=>delete x.bothStatementPostingDate]){const q=copy(p);f(q);assert.throws(()=>classifyPostingDates(q,s,{}))}
 const competing=copy(s);competing.transactions.push({...p.oldOrigin,id:'other',date:'2024-12-21'});assert.throws(()=>classifyPostingDates(p,competing,{}));
 const h=harness(false,{},s);h.d.expectedPlan=(await correctPostingDates(p,false,h.d)).planHash;assert((await correctPostingDates(p,true,h.d)).verified);assert.deepEqual(h.live.transactions.map(x=>x.date),['2024-12-30','2024-12-30']);assert((await correctPostingDates(p,true,h.d)).verified);
});
function destinationReceiptFixture(){const p=copy(candidate);delete p.destinationStatementId;p.originDate='2024-12-03';p.destinationDate='2024-12-02';p.destinationReceiptEvidence={receiptId:'19484a977d96c190',date:'2024-12-02'};return p}
test('accepts only an independent destination issuer receipt for an unchanged destination date',async()=>{
 const p=destinationReceiptFixture(),plan=classifyPostingDates(p,snapshot,{});assert.deepEqual(plan.changedIds,['origin']);
 for(const f of [x=>delete x.destinationReceiptEvidence,x=>x.destinationReceiptEvidence.receiptId=x.receiptId,x=>x.destinationReceiptEvidence.receiptId='bad',x=>x.destinationReceiptEvidence.date='2024-12-03',x=>x.destinationDate='2024-11-29',x=>x.destinationReceiptEvidence.extra=true,x=>x.destinationStatementId='duplicate-statement']){const q=copy(p);f(q);assert.throws(()=>classifyPostingDates(q,snapshot,{}))}
 assert.throws(()=>classifyPostingDates(p,snapshot,{records:{'19484a977d96c190':{transactionId:'other'}}}));assert.throws(()=>classifyPostingDates(p,snapshot,{cashflows:{x:{sourceIds:['19484a977d96c190']}}}));assert.throws(()=>classifyPostingDates(p,snapshot,{incomeStatementDateCorrections:{other:{receiptId:p.receiptId}}}));const s=copy(snapshot);s.transactions.push({...origin,id:'unrelated',amount:-1,notes:'https://mail.google.com/mail/u/0/#all/19484a977d96c190'});assert.throws(()=>classifyPostingDates(p,s,{}));
 const h=harness();h.d.expectedPlan=(await correctPostingDates(p,false,h.d)).planHash;assert((await correctPostingDates(p,true,h.d)).verified);assert.equal(h.live.transactions[0].date,'2024-12-03');assert.equal(h.live.transactions[1].date,'2024-12-02');const n=h.events.length;assert((await correctPostingDates(p,true,h.d)).verified);assert.equal(h.events.length,n);
});
