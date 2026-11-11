import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMixedComponent } from './actual-uber-mixed-component.mjs';

function fixture() {
  const card = {id:'card-row', account:'card', date:'2024-11-17', amount:-285500, payee:'uber', category:'transport', notes:'Viaje; parte Uber Cash pendiente.\nhttps://mail.google.com/mail/u/0/#all/193384b35772aba9\nhttps://drive.google.com/file/d/statement-id/view', imported_id:'bank:ride', transfer_id:null};
  const record = {type:'expense', status:'registered', verifiedAt:'2026-01-01', id:card.id, account:card.account, date:card.date, amount:card.amount, category:card.category, sourceIds:['193384b35772aba9'], driveFileIds:['statement-id']};
  const candidate = {mixedUberCashComponent:true, currency:'CLP', wallet:'wallet', receipt:'193384b35772aba9', statementFileId:'statement-id', cardSourceKey:'bank:ride', cardTransaction:card, cardRecord:record, amount:-24300, total:-309800, evidence:'Complete receipt and matching statement examined carefully.'};
  const snapshot = {accounts:[{id:'card',name:'Card'},{id:'wallet',name:'Uber Cash - historial parcial'}], transactions:[card], balances:{card:-285500,wallet:0}, payees:[{id:'uber',name:'Uber'}], categories:[{id:'transport',name:'Transportation'}], rules:[], schedules:[], dashboards:[]};
  return {candidate,snapshot,ledger:{cashflows:{'bank:ride':record}}};
}

test('accepts exactly evidenced card and wallet components and binds state',()=>{
  const {candidate,snapshot,ledger}=fixture();
  const result=classifyMixedComponent(candidate,snapshot,ledger);
  assert.equal(result.action,'create'); assert.match(result.planHash,/^[a-f0-9]{64}$/);
  snapshot.balances.wallet=-100; assert.notEqual(classifyMixedComponent(candidate,snapshot,ledger).planHash,result.planHash);
});

test('accepts Uber Eats in dining but rejects mismatched merchant and category pairs',()=>{
 const f=fixture();f.snapshot.payees[0].name='Uber Eats';f.snapshot.categories[0].name='Eating Out & Delivery';
 assert.equal(classifyMixedComponent(f.candidate,f.snapshot,f.ledger).action,'create');
 for(const [payee,category] of [['Uber Eats','Transportation'],['Uber','Eating Out & Delivery'],['Other Eats','Eating Out & Delivery']]){const g=fixture();g.snapshot.payees[0].name=payee;g.snapshot.categories[0].name=category;assert.throws(()=>classifyMixedComponent(g.candidate,g.snapshot,g.ledger));}
});

test('rejects incorrect totals, source ownership and existing wallet duplicates',()=>{
  for(const mutate of [x=>x.candidate.total--,x=>x.ledger.cashflows['bank:ride'].sourceIds=[],x=>x.snapshot.transactions.push({...x.snapshot.transactions[0],id:'duplicate',account:'wallet',amount:-24300}),x=>x.candidate.cardTransaction.date='invalid',x=>x.candidate.cardTransaction.imported_id='bank:other',x=>x.ledger.cashflows['bank:other']={sourceIds:[x.candidate.receipt]}]){
    const f=fixture(); mutate(f); assert.throws(()=>classifyMixedComponent(f.candidate,f.snapshot,f.ledger));
  }
});

function harness(options={}) {
  const {candidate,snapshot,ledger:initial}=fixture(); let live=structuredClone(snapshot), ledger=structuredClone(initial); const events=[];
  const api={async shutdown(){},async sync(){},async addTransactions(account,rows){events.push('write'); const row=rows[0];live.transactions.push({id:'created',account,...row,transfer_id:null,subtransactions:[],reconciled:false});live.balances[account]+=row.amount;if(options.interrupt)throw Error('interrupted');if(options.corrupt)live.transactions[0].notes='changed';},async updateTransaction(id,patch){events.push('update');Object.assign(live.transactions.find(t=>t.id===id),patch);if(options.interruptNote)throw Error('note interrupted')}};
  const deps={async connect(){return {api}},async snapshot(){const s=structuredClone(live);delete s.dashboards;return s},async readDashboard(){return structuredClone(live.dashboards)},async readState(){return structuredClone(ledger)},async requireRun(){return structuredClone(ledger)},async save(x){ledger=structuredClone(x);events.push('audit:'+ledger.mixedUberCashComponents?.[candidate.receipt]?.status)},async backup(){events.push('backup');if(options.concurrent)live.transactions[0].notes='changed';return '/backup'},async json(){}};
  return {candidate,deps,events,get live(){return live},get ledger(){return ledger}};
}

test('backs up, posts one wallet component, verifies independently and retries read-only',async()=>{
 const {recordMixedComponent}=await import('./actual-uber-mixed-component.mjs');const h=harness();const plan=await recordMixedComponent(h.candidate,false,h.deps);h.deps.expectedPlan=plan.planHash;const done=await recordMixedComponent(h.candidate,true,h.deps);
 assert.equal(done.verified,true);assert.equal(done.id,'created');assert.equal(h.ledger.mixedUberCashComponents[h.candidate.receipt].status,'complete');assert.equal(h.live.balances.wallet,-24300);assert.equal(h.events.filter(x=>x==='write').length,1);
 h.live.transactions.push({id:'later',account:'wallet',amount:-500,date:'2024-11-30'});h.live.balances.wallet-=500;const count=h.events.length;assert.equal((await recordMixedComponent(h.candidate,true,h.deps)).action,'existing');assert.equal(h.events.length,count);
 h.live.transactions.find(t=>t.id==='created').amount--;await assert.rejects(recordMixedComponent(h.candidate,true,h.deps));
});

test('stale plans and interrupted writes fail closed',async()=>{
 const {recordMixedComponent}=await import('./actual-uber-mixed-component.mjs');
 for(const opts of [{interrupt:true},{corrupt:true},{concurrent:true}]) {const h=harness(opts);const p=await recordMixedComponent(h.candidate,false,h.deps);h.deps.expectedPlan=p.planHash;await assert.rejects(recordMixedComponent(h.candidate,true,h.deps));if(opts.concurrent)assert(!h.events.includes('write'));else {assert.equal(h.ledger.mixedUberCashComponents[h.candidate.receipt].status,'pending');const n=h.events.length;await assert.rejects(recordMixedComponent(h.candidate,true,h.deps),/pending/i);assert.equal(h.events.length,n)}}
});

test('reserves identities even when referenced through a nested specialized candidate',async()=>{
 const {mixedComponentSourceConflict}=await import('./actual-uber-mixed-component.mjs');const l={mixedUberCashComponents:{a:{status:'complete',id:'wallet-id',candidate:{receipt:'193384b35772aba9',cardTransaction:{id:'card-id'}}}}};
 for(const c of [{sourceId:'gmail:193384b35772aba9'},{otherOperation:true,existing:{transactionId:'card-id'}},{otherOperation:true,existing:{transactionId:'wallet-id'}}])assert(mixedComponentSourceConflict(c,l));
});

test('amends only an audited card note and preserves original-group retry',async()=>{
 const {recordMixedComponent,amendMixedComponentNote}=await import('./actual-uber-mixed-component.mjs'),h=harness();const p=await recordMixedComponent(h.candidate,false,h.deps);h.deps.expectedPlan=p.planHash;await recordMixedComponent(h.candidate,true,h.deps);
 const amendment={mixedUberCashNoteAmendment:true,currency:'CLP',receipt:h.candidate.receipt,oldText:'parte Uber Cash pendiente',newText:'parte Uber Cash registrada',evidence:'The independently verified shared source group establishes the wallet component.'};
 const preview=await amendMixedComponentNote(amendment,false,h.deps);assert.equal(preview.action,'amend');h.deps.expectedPlan=preview.planHash;const done=await amendMixedComponentNote(amendment,true,h.deps);assert(done.verified);assert.match(h.live.transactions[0].notes,/parte Uber Cash registrada/);assert.equal(h.ledger.mixedUberCashNoteAmendments[amendment.receipt].status,'complete');
 const n=h.events.length;assert.equal((await amendMixedComponentNote(amendment,true,h.deps)).action,'existing');h.deps.expectedPlan=p.planHash;assert.equal((await recordMixedComponent(h.candidate,true,h.deps)).action,'existing');assert.equal(h.events.length,n);
 h.ledger.mixedUberCashNoteAmendments[amendment.receipt].candidate.newText='other';await assert.rejects(recordMixedComponent(h.candidate,true,h.deps));
});

test('rejects protected metadata and blocks retry after interrupted note update',async()=>{
 const {recordMixedComponent,amendMixedComponentNote}=await import('./actual-uber-mixed-component.mjs'),h=harness({interruptNote:true});const p=await recordMixedComponent(h.candidate,false,h.deps);h.deps.expectedPlan=p.planHash;await recordMixedComponent(h.candidate,true,h.deps);
 const amendment={mixedUberCashNoteAmendment:true,currency:'CLP',receipt:h.candidate.receipt,oldText:'parte Uber Cash pendiente',newText:'parte Uber Cash registrada',evidence:'The independently verified shared source group establishes the wallet component.'};
 for(const bad of [{...amendment,oldText:'https://mail.google.com/mail/u/0/#all/193384b35772aba9'},{...amendment,newText:'#newtag'}])await assert.rejects(amendMixedComponentNote(bad,false,h.deps));
 const preview=await amendMixedComponentNote(amendment,false,h.deps);h.deps.expectedPlan=preview.planHash;await assert.rejects(amendMixedComponentNote(amendment,true,h.deps),/interrupted/);assert.equal(h.ledger.mixedUberCashNoteAmendments[amendment.receipt].status,'pending');await assert.rejects(amendMixedComponentNote(amendment,true,h.deps),/pending/i);
});
