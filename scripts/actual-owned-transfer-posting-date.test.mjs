import test from 'node:test';
import assert from 'node:assert/strict';
import * as moduleUnderTest from './actual-transfer-posting-dates.mjs';
import {classifyCashflow,cashflow} from './actual-cashflow.mjs';

const sourceId='bank:example:20251030:card:500000',receiptId='19a3774fd48200a2',destinationStatementId='card-statement-verified';
const notes=`Payment\nhttps://mail.google.com/mail/u/0/#all/${receiptId}\nhttps://drive.google.com/file/d/${destinationStatementId}/view\nsource=${sourceId}`;
const origin={id:'origin',account:'checking',date:'2025-10-30',amount:-50000000,payee:'to-card',transfer_id:'destination',notes,imported_id:sourceId};
const destination={id:'destination',account:'card',date:'2025-10-30',amount:50000000,payee:'to-checking',transfer_id:'origin',notes,imported_id:null};
const record={type:'transfer',id:'origin',counterpartId:'destination',currency:'CLP',account:'checking',destination:'card',date:'2025-10-30',amount:-50000000,category:null,sourceIds:[receiptId],driveFileIds:[destinationStatementId],evidence:'Payment receipt proves origin and destination.',counterpartyEvidence:'Card statement proves the payment.',backup:'/verified-backup',verifiedAt:'2026-11-05T00:00:00Z'};
const oldCandidate={cashflow:true,type:'transfer',currency:'CLP',account:'checking',destination:'card',date:'2025-10-30',amount:-50000000,sourceId,sourceIds:[receiptId],driveFileIds:[destinationStatementId],evidence:record.evidence,counterpartyEvidence:record.counterpartyEvidence,notes:'Payment'};
const candidate={ownedTransferPostingDate:true,currency:'CLP',sourceId,oldCandidate,oldRecord:record,oldOrigin:origin,oldDestination:destination,originDate:'2025-11-03',receiptId,originStatementId:'checking-statement-verified',destinationStatementId,evidence:'Independently reviewed receipt and both statements identify one transfer with distinct posting dates.'};
const snapshot={accounts:[{id:'checking'},{id:'card'}],payees:[{id:'to-card',transfer_acct:'card'},{id:'to-checking',transfer_acct:'checking'}],transactions:[origin,destination],balances:{checking:-50000000,card:50000000},categories:[],rules:[],schedules:[],dashboards:[]};
const ledger={cashflows:{[sourceId]:record}};
const copy=structuredClone;

test('previews only the owned origin posting change and binds all state',()=>{
 assert.equal(typeof moduleUnderTest.classifyOwnedPostingDate,'function');
 const p=moduleUnderTest.classifyOwnedPostingDate(candidate,snapshot,ledger);
 assert.equal(p.action,'correct');assert.equal(p.changedId,'origin');assert.match(p.planHash,/^[a-f0-9]{64}$/);
 assert.deepEqual(p.dailyImpact.map(x=>x.delta),[50000000,50000000,50000000,50000000]);
 const s=copy(snapshot);s.accounts[0].name='changed';assert.notEqual(moduleUnderTest.classifyOwnedPostingDate(candidate,s,ledger).planHash,p.planHash);
});

test('rejects stale ownership, invalid source evidence and competing movements',()=>{
 const classify=moduleUnderTest.classifyOwnedPostingDate;
 assert.equal(typeof classify,'function');
 for(const change of [p=>p.oldRecord.backup=null,p=>p.oldRecord.verifiedAt=null,p=>p.oldRecord.sourceIds=[],p=>p.destinationStatementId=p.originStatementId,p=>p.originDate='2025-11-04',p=>p.receiptId='0000000000000000',p=>p.oldOrigin.reconciled=true,p=>p.oldDestination.amount--]){const p=copy(candidate);change(p);assert.throws(()=>classify(p,snapshot,ledger));}
 const s=copy(snapshot);s.transactions.push({...origin,id:'competing',imported_id:null});assert.throws(()=>classify(candidate,s,ledger));
 const l=copy(ledger);l.cashflows.other={id:'origin'};assert.throws(()=>classify(candidate,snapshot,l));
});

test('accepts an original origin statement only when both distinct statements are independently supplied',()=>{
 const p=copy(candidate),s=copy(snapshot),l=copy(ledger),originStatement=p.originStatementId;
 p.oldRecord.driveFileIds=[originStatement];p.oldCandidate.driveFileIds=[originStatement];p.oldOrigin.notes=p.oldOrigin.notes.replace(destinationStatementId,originStatement);p.oldDestination.notes=p.oldDestination.notes.replace(destinationStatementId,originStatement);
 s.transactions=[copy(p.oldOrigin),copy(p.oldDestination)];l.cashflows[sourceId]=copy(p.oldRecord);
 assert.equal(moduleUnderTest.classifyOwnedPostingDate(p,s,l).action,'correct');
 const unrelated=copy(p);unrelated.originStatementId='another-statement';assert.throws(()=>moduleUnderTest.classifyOwnedPostingDate(unrelated,s,l));
 const same=copy(p);same.destinationStatementId=same.originStatementId;assert.throws(()=>moduleUnderTest.classifyOwnedPostingDate(same,s,l));
});

function harness({fail=false,corrupt=false,initialSnapshot=snapshot,initialLedger=ledger}={}){
 let live=copy(initialSnapshot),state=copy(initialLedger),writes=0,events=[];
 const api={async sync(){},async shutdown(){},async updateTransaction(id,changes){events.push('write');writes++;if(fail===true||fail===writes)throw Error('interrupted');Object.assign(live.transactions.find(t=>t.id===id),changes);if(corrupt)live.transactions.find(t=>t.id==='destination').amount++;}};
 return{get live(){return live},get ledger(){return state},get writes(){return writes},events,d:{async connect(){return{api}},async snapshot(){return copy(live)},async readDashboard(){return []},async readState(){return copy(state)},async requireRun(){return copy(state)},async save(s){state=copy(s);events.push('audit:'+state.ownedTransferPostingDateCorrections?.origin?.status)},async backup(){events.push('backup');return '/new-backup'},async json(){}}};
}
test('backs up, persists intent, changes only the origin date and retries without a write',async()=>{
 assert.equal(typeof moduleUnderTest.correctOwnedPostingDate,'function');const h=harness();const plan=await moduleUnderTest.correctOwnedPostingDate(candidate,false,h.d);h.d.expectedPlan=plan.planHash;
 const done=await moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d);assert(done.verified);assert.equal(h.live.transactions[0].date,'2025-11-03');assert.deepEqual(h.live.transactions[1],destination);assert.deepEqual(h.ledger.cashflows[sourceId],record);assert(h.events.indexOf('backup')<h.events.indexOf('audit:pending'));assert(h.events.indexOf('audit:pending')<h.events.indexOf('write'));
 const n=h.events.length;assert.equal((await moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d)).action,'existing');assert.equal(h.events.length,n);assert.equal(h.writes,1);
});

function commonOwnedFixture(){
 const p=copy(candidate),s=copy(snapshot),l=copy(ledger),shared=['19b8208f341a3bf5','19bb2b01cd7f1e1a'],receipt2='19ae545da28f2fd2';
 p.destinationDate=p.originDate;p.statementMessages={origin:shared[0],destination:shared[1]};p.oldCandidate.sourceIds=p.oldRecord.sourceIds=[receiptId,receipt2,...shared];delete p.oldCandidate.driveFileIds;delete p.oldRecord.driveFileIds;
 const n=[p.oldCandidate.notes,...p.oldCandidate.sourceIds.map(x=>'https://mail.google.com/mail/u/0/#all/'+x),'source='+sourceId].join('\n');p.oldOrigin.notes=p.oldDestination.notes=n;s.transactions=[copy(p.oldOrigin),copy(p.oldDestination),{...copy(p.oldOrigin),id:'other',amount:-1,date:'2024-01-01',transfer_id:null,imported_id:'bank:other',notes:'https://mail.google.com/mail/u/0/#all/'+shared[0]}];l.cashflows[sourceId]=copy(p.oldRecord);l.cashflows.other={id:'other',sourceIds:shared};return{p,s,l,shared};
}
test('accepts only explicitly shared statement messages for common posting dates',()=>{
 const {p,s,l,shared}=commonOwnedFixture(),plan=moduleUnderTest.classifyOwnedPostingDate(p,s,l);assert.equal(plan.action,'correct');assert.deepEqual(plan.changedIds,['origin','destination']);assert.equal(plan.dailyImpact.length,8);
 for(const change of [q=>q.statementMessages.origin=q.statementMessages.destination,q=>q.statementMessages.origin='aaaaaaaaaaaaaaaa',q=>q.destinationDate='2025-11-02',q=>q.oldCandidate.sourceIds.pop()]){const q=copy(p);change(q);assert.throws(()=>moduleUnderTest.classifyOwnedPostingDate(q,s,l));}
 const bad=copy(l);bad.cashflows.other.sourceIds=[receiptId,...shared];assert.throws(()=>moduleUnderTest.classifyOwnedPostingDate(p,s,bad));
});
test('common posting verifies both writes, preserves shared records and blocks after a partial update',async()=>{
 const {p,s,l}=commonOwnedFixture();let h=harness({initialSnapshot:s,initialLedger:l});h.d.expectedPlan=(await moduleUnderTest.correctOwnedPostingDate(p,false,h.d)).planHash;assert((await moduleUnderTest.correctOwnedPostingDate(p,true,h.d)).verified);assert.deepEqual(h.live.transactions.slice(0,2).map(t=>t.date),[p.originDate,p.destinationDate]);assert.deepEqual(h.ledger.cashflows,l.cashflows);assert.equal(classifyCashflow(p.oldCandidate,h.live,h.ledger).action,'existing');const n=h.events.length;assert((await moduleUnderTest.correctOwnedPostingDate(p,true,h.d)).verified);assert.equal(h.events.length,n);
 h=harness({fail:2,initialSnapshot:s,initialLedger:l});h.d.expectedPlan=(await moduleUnderTest.correctOwnedPostingDate(p,false,h.d)).planHash;await assert.rejects(moduleUnderTest.correctOwnedPostingDate(p,true,h.d),/interrupted/);assert.equal(h.ledger.ownedTransferPostingDateCorrections.origin.status,'pending');assert.equal(h.live.transactions[0].date,p.originDate);assert.equal(h.live.transactions[1].date,p.oldDestination.date);
});
test('interruption or unexpected remote changes retain pending intent',async()=>{
 for(const opts of [{fail:true},{corrupt:true}]){const h=harness(opts);h.d.expectedPlan=(await moduleUnderTest.correctOwnedPostingDate(candidate,false,h.d)).planHash;await assert.rejects(moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d));assert.equal(h.ledger.ownedTransferPostingDateCorrections.origin.status,'pending');await assert.rejects(moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d),/pending/i)}
});
test('a stale plan fails before backup or any mutation',async()=>{
 const h=harness();h.d.expectedPlan='stale';await assert.rejects(moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d),/plan/i);assert.deepEqual(h.events,[]);
});

test('the exact original cashflow retry verifies a complete linked audit without rewriting its ledger',async()=>{
 const h=harness();h.d.expectedPlan=(await moduleUnderTest.correctOwnedPostingDate(candidate,false,h.d)).planHash;await moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d);
 const action=classifyCashflow(oldCandidate,h.live,h.ledger);assert.equal(action.action,'existing');assert.equal(action.ownedPostingDate,true);
 const n=h.events.length;const result=await cashflow(oldCandidate,true,{...h.d,budgets:{CLP:{syncId:'CLP'}},equal:assert.deepEqual});assert.equal(result.action,'existing');assert(result.verified);assert.equal(h.events.length,n);assert.deepEqual(h.ledger.cashflows[sourceId],record);
});
test('original retry rejects changed candidates, pending and ambiguous correction chains',async()=>{
 const h=harness();h.d.expectedPlan=(await moduleUnderTest.correctOwnedPostingDate(candidate,false,h.d)).planHash;await moduleUnderTest.correctOwnedPostingDate(candidate,true,h.d);
 let l=copy(h.ledger);l.ownedTransferPostingDateCorrections.origin.status='pending';assert.equal(classifyCashflow(oldCandidate,h.live,l).action,'review');
 l=copy(h.ledger);l.ownedTransferPostingDateCorrections.other=copy(l.ownedTransferPostingDateCorrections.origin);assert.equal(classifyCashflow(oldCandidate,h.live,l).action,'review');
 const c=copy(oldCandidate);c.evidence='Changed';assert.equal(classifyCashflow(c,h.live,h.ledger).action,'review');
});
