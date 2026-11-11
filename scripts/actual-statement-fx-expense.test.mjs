import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStatementFxExpense, migrateStatementFxExpense, migrationSourceConflict, hasPendingFxExpenseMigration } from './actual-statement-fx-expense.mjs';

function fixture() {
 const old={id:'old-id',account:'clp-card',date:'2026-01-01',amount:-100000,payee:'clp-shop',category:'clp-cat',notes:'#tag\nPurchase\nhttps://mail.google.com/mail/u/0/#all/abc123\nhttps://mail.google.com/mail/u/0/#all/def456',imported_id:'gmail:abc123',is_parent:false,is_child:false,parent_id:null,transfer_id:null,schedule:null,reconciled:false,cleared:false,subtransactions:[]};
 const rec={transactionId:old.id,currency:'CLP',account:old.account,date:old.date,amount:old.amount,payee:'Shop',category:old.category,sourceIds:['abc123','def456'],status:'registered',verifiedAt:'time',notesAmendments:[{oldNotes:'prior',newNotes:'Purchase',verifiedAt:'time',backup:'/private'}]};
 const p={statementFxExpenseMigration:true,oldTransaction:old,oldRecord:rec,sourceId:'abc123',sourceIds:['abc123','def456'],usd:{account:'usd-card',amount:-115,payee:'usd-shop',category:'usd-cat'},statementFileId:'statement123',evidence:'Operator verified original purchase and exact billed currency amount in the statement.'};
 const clp={accounts:[{id:'clp-card',offbudget:false,closed:false}],transactions:[old],balances:{'clp-card':-100000},payees:[{id:'clp-shop',name:'Shop'}],categories:[{id:'clp-cat',name:'Monthly subscriptions',hidden:false,is_income:false}],rules:[],schedules:[]};
 const usd={accounts:[{id:'usd-card',offbudget:false,closed:false}],transactions:[],balances:{'usd-card':0},payees:[{id:'usd-shop',name:'Shop'}],categories:[{id:'usd-cat',name:'Monthly subscriptions',hidden:false,is_income:false}],rules:[],schedules:[]};
 return {p,s:{clp,usd},ledger:{records:{abc123:structuredClone(rec),def456:structuredClone(rec)}},dashboards:{clp:[],usd:[]}};
}
test('plans an exact source-owned expense with separate billed currency',()=>{
 const {p,s,ledger,dashboards}=fixture();const out=classifyStatementFxExpense(p,s,ledger,dashboards);
 assert.equal(out.action,'migrate');assert.match(out.planHash,/^[a-f0-9]{64}$/);assert.equal(out.clpDelta,100000);assert.equal(out.usdDelta,-115);
});
test('rejects ambiguous source, changed ledger, destination or reconciled target',()=>{
 for(const change of [
  (p,s,l)=>s.clp.transactions[0].reconciled=true,
  (p,s,l)=>l.records.def456.amount--,
  (p,s,l)=>s.usd.transactions.push({...p.oldTransaction,id:'other'}),
  (p,s,l)=>s.usd.categories[0].name='Unrelated category',
  (p,s,l)=>s.clp.transactions.push({...p.oldTransaction,id:'duplicate'}),
  (p,s,l)=>l.records.xyz={transactionId:p.oldTransaction.id},
 ]) {const {p,s,ledger,dashboards}=fixture();change(p,s,ledger);assert.throws(()=>classifyStatementFxExpense(p,s,ledger,dashboards));}
});
function withDistinctPeer(){
 const x=fixture(),peer={id:'peer-id',account:'usd-card',date:'2026-01-02',amount:-115,payee:'peer-shop',category:'usd-cat',notes:'Independent merchant',imported_id:'gmail:fedcba',is_parent:false,is_child:false,parent_id:null,transfer_id:null,schedule:null,reconciled:false,cleared:false,subtransactions:[]};
 x.s.usd.payees.push({id:'peer-shop',name:'Other merchant'});x.s.usd.transactions.push(peer);x.s.usd.balances['usd-card']=-115;
 x.p.distinctStatementPeers={transactionReference:'123456789',transactionDate:'2026-01-01',peers:[{transaction:structuredClone(peer),statementReference:'987654321',statementDate:'2026-01-02',evidence:'Statement shows a separate charge for another merchant on the same card.'}]};return x;
}
test('allows exact distinct same-amount peer only with separate statement identities',()=>{
 const {p,s,ledger,dashboards}=withDistinctPeer();assert.equal(classifyStatementFxExpense(p,s,ledger,dashboards).action,'migrate');
});
test('rejects omitted, extra, stale, same-merchant, reused or inconsistent peer evidence',()=>{
 for(const change of [
  x=>delete x.p.distinctStatementPeers,
  x=>x.p.distinctStatementPeers.peers=[],
  x=>x.p.distinctStatementPeers.peers[0].transaction.notes='changed',
  x=>x.p.distinctStatementPeers.peers[0].statementReference=x.p.distinctStatementPeers.transactionReference,
  x=>x.p.distinctStatementPeers.peers[0].statementDate='2026-02-01',
  x=>{x.s.usd.transactions[0].payee='usd-shop';x.p.distinctStatementPeers.peers[0].transaction.payee='usd-shop'},
  x=>x.p.distinctStatementPeers.peers.push(structuredClone(x.p.distinctStatementPeers.peers[0])),
 ]){const x=withDistinctPeer();change(x);assert.throws(()=>classifyStatementFxExpense(x.p,x.s,x.ledger,x.dashboards));}
});
test('source guard refuses an original-currency replay and pending state blocks mutation',()=>{
 const l={statementFxExpenseMigrations:{'old-id':{status:'complete',candidate:{sourceIds:['abc123'],oldTransaction:{id:'old-id'}},newId:'new-id'}}};
 assert(migrationSourceConflict({sourceId:'abc123',sourceIds:['abc123'],currency:'CLP'},l));
 assert(migrationSourceConflict({sourceId:'abc123',sourceIds:['abc123'],currency:'USD'},l));
 assert(migrationSourceConflict({nested:{evidence:'gmail:abc123'}},l));
 assert(!migrationSourceConflict({sourceId:'unrelated',currency:'USD'},l));
 assert(hasPendingFxExpenseMigration({statementFxExpenseMigrations:{x:{status:'pending'}}}));
});

function harness(failStage,sourceFixture=fixture()) {
 let {p,s,ledger,dashboards}=sourceFixture;const events=[];
 const d={budgets:{CLP:{syncId:'CLP'},USD:{syncId:'USD'}},expectedPlan:null,
  async connect(key){const name=key.toLowerCase();return {api:{name,async sync(){},async shutdown(){},
   async addTransactions(account,rows){events.push('create');if(failStage==='create')throw Error('create failure');if(failStage==='silent-create')return;s.usd.transactions.push({...rows[0],id:'new-id',account,is_parent:false,is_child:false,parent_id:null,transfer_id:null,schedule:null,reconciled:false,subtransactions:[]});s.usd.balances[account]+=rows[0].amount},
   async deleteTransaction(id){events.push('delete');if(failStage==='delete')throw Error('delete failure');s.clp.transactions=s.clp.transactions.filter(t=>t.id!==id);s.clp.balances['clp-card']+=100000}
  }}},async snapshot(api){return structuredClone(s[api.name])},async readDashboard(api){return structuredClone(dashboards[api.name])},
  async backup(api){events.push('backup:'+api.name);return '/backup/'+api.name},async json(){},async readState(){return structuredClone(ledger)},async requireRun(){return structuredClone(ledger)},async save(v){ledger=structuredClone(v);events.push('audit:'+Object.values(ledger.statementFxExpenseMigrations??{})[0]?.status)}
 };
 return {p,d,events,get ledger(){return ledger},get state(){return s},changeLedger(){ledger.extra={changed:true}},changeDashboard(){dashboards.usd.push({id:'changed'})}};
}
test('backups and pending audit precede writes; lineage and aliases survive; retry only reads',async()=>{
 const h=harness();const plan=await migrateStatementFxExpense(h.p,false,h.d);h.d.expectedPlan=plan.planHash;
 const out=await migrateStatementFxExpense(h.p,true,h.d);assert.equal(out.verified,true);assert.deepEqual(h.events,['backup:clp','backup:usd','audit:pending','create','delete','audit:complete']);
 assert.equal(h.ledger.records.abc123.transactionId,'new-id');assert.deepEqual(h.ledger.records.abc123,h.ledger.records.def456);assert.deepEqual(h.ledger.records.abc123.notesAmendments,h.p.oldRecord.notesAmendments);
 assert.deepEqual(h.ledger.statementFxExpenseMigrations['old-id'].candidate.oldRecord,h.p.oldRecord);assert.equal(h.state.clp.transactions.length,0);assert.equal(h.state.usd.transactions.length,1);
 let count=h.events.length;assert.equal((await migrateStatementFxExpense(h.p,true,h.d)).action,'existing');assert.equal(h.events.length,count);
});
test('a completed migration preserves an independently evidenced peer without mutation',async()=>{
 const f=withDistinctPeer(),peer=structuredClone(f.s.usd.transactions[0]);const h=harness(undefined,f);h.d.expectedPlan=(await migrateStatementFxExpense(h.p,false,h.d)).planHash;
 assert((await migrateStatementFxExpense(h.p,true,h.d)).verified);assert.deepEqual(h.state.usd.transactions.find(t=>t.id===peer.id),peer);assert.equal(h.state.usd.transactions.length,2);
});
test('partial failure retains pending intent and never repeats a financial write',async()=>{
 const h=harness('delete');h.d.expectedPlan=(await migrateStatementFxExpense(h.p,false,h.d)).planHash;
 await assert.rejects(migrateStatementFxExpense(h.p,true,h.d),/delete failure/);assert.equal(h.ledger.statementFxExpenseMigrations['old-id'].status,'pending');
 const count=h.events.length;await assert.rejects(migrateStatementFxExpense(h.p,true,h.d),/pending/i);assert.equal(h.events.length,count);
});
test('a silent destination failure never deletes the original expense',async()=>{
 const h=harness('silent-create');h.d.expectedPlan=(await migrateStatementFxExpense(h.p,false,h.d)).planHash;
 await assert.rejects(migrateStatementFxExpense(h.p,true,h.d),/missing|duplicate/i);assert(!h.events.includes('delete'));assert.equal(h.state.clp.transactions.length,1);
});
test('changed ledger or dashboard invalidates the reviewed plan before backup',async()=>{
 for(const change of ['changeLedger','changeDashboard']){const h=harness();h.d.expectedPlan=(await migrateStatementFxExpense(h.p,false,h.d)).planHash;h[change]();await assert.rejects(migrateStatementFxExpense(h.p,true,h.d),/plan hash/i);assert.equal(h.events.length,0);}
});
