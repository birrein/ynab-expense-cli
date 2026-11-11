import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPartialIncomeDedup,partialIncomeHash} from './actual-partial-income-dedup.mjs';
const old={id:'aggregate',account:'acct',date:'2024-04-04',amount:10000,payee:'legacy',category:'legacycat',notes:'profit',imported_id:null,transfer_id:null,is_parent:false,is_child:false,parent_id:null,subtransactions:[],reconciled:false,schedule:null,starting_balance_flag:false,tombstone:false};
const credit={...old,id:'component',date:'2024-03-27',amount:2000,payee:'income',category:'income',notes:'source=bank:example:1',imported_id:'bank:example:1'};
const rec={id:'component',type:'income',currency:'CLP',account:'acct',date:'2024-03-27',amount:2000,category:'income',status:'registered',verifiedAt:'2024-04-01',driveFileIds:['statement1']};
const candidate={partialHistoricalIncomeDedup:true,currency:'CLP',oldTransaction:old,components:[{transaction:credit,record:rec}],residual:8000,statementFileIds:['statement1','statement2'],evidence:'Statement rows and aggregate were independently inspected and matched.'};
const snapshot={accounts:[{id:'acct',closed:false,offbudget:false}],transactions:[old,credit],balances:{acct:12000},categories:[],payees:[],rules:[],schedules:[]};
const ledger={cashflows:{'bank:example:1':rec},records:{}};
test('plans exact verified components and residual',()=>{assert.equal(classifyPartialIncomeDedup(candidate,snapshot,ledger).action,'adjust');assert.match(partialIncomeHash(candidate,snapshot),/^[0-9a-f]{64}$/)});
test('rejects stale component and incorrect residual',()=>{const c=structuredClone(candidate);c.components[0].transaction.amount++;assert.throws(()=>classifyPartialIncomeDedup(c,snapshot,ledger));const d=structuredClone(candidate);d.residual++;assert.throws(()=>classifyPartialIncomeDedup(d,snapshot,ledger))});
test('rejects unverified ledger or duplicate source',()=>{const l=structuredClone(ledger);l.cashflows['bank:example:1'].verifiedAt=null;assert.throws(()=>classifyPartialIncomeDedup(candidate,snapshot,l));const c=structuredClone(candidate);c.components.push(c.components[0]);assert.throws(()=>classifyPartialIncomeDedup(c,snapshot,ledger))});
test('rejects a pending intent and unrelated ownership',()=>{const l=structuredClone(ledger);l.partialHistoricalIncomeDedups={aggregate:{status:'pending',candidate}};assert.throws(()=>classifyPartialIncomeDedup(candidate,snapshot,l));const l2=structuredClone(ledger);l2.records.foo={transactionId:'aggregate'};assert.throws(()=>classifyPartialIncomeDedup(candidate,snapshot,l2))});

test('execution persists intent before write and verifies only the aggregate changes',async()=>{
 const {adjustPartialIncomeDedup}=await import('./actual-partial-income-dedup.mjs');let budget=structuredClone(snapshot),state=structuredClone(ledger),writes=0;
 const deps={connect:async()=>({api:{sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,update)=>{assert.equal(state.partialHistoricalIncomeDedups.aggregate.status,'pending');writes++;const t=budget.transactions.find(x=>x.id===id);budget.balances.acct+=update.amount-t.amount;t.amount=update.amount}}}),snapshot:async()=>structuredClone(budget),backup:async()=>'/backup',json:async()=>{},readState:async()=>structuredClone(state),requireRun:async()=>structuredClone(state),save:async(x)=>{state=structuredClone(x)}};
 const plan=await adjustPartialIncomeDedup(candidate,false,deps);const r=await adjustPartialIncomeDedup(candidate,true,{...deps,expectedPlan:plan.planHash});assert.equal(r.verified,true);assert.equal(writes,1);assert.equal(budget.transactions[0].amount,8000);assert.equal(budget.balances.acct,10000);assert.equal(state.partialHistoricalIncomeDedups.aggregate.status,'complete');
 const retry=await adjustPartialIncomeDedup(candidate,true,{...deps,expectedPlan:'ignored'});assert.equal(retry.action,'existing');assert.equal(writes,1);
});
test('changed plan hash prevents backup and write',async()=>{
 const {adjustPartialIncomeDedup}=await import('./actual-partial-income-dedup.mjs');let writes=0;const deps={connect:async()=>({api:{shutdown:async()=>{},updateTransaction:async()=>{writes++}}}),snapshot:async()=>structuredClone(snapshot),requireRun:async()=>structuredClone(ledger),backup:async()=>{throw Error('backup should not run')},expectedPlan:'wrong'};
 await assert.rejects(adjustPartialIncomeDedup(candidate,true,deps),/Plan missing or changed/);assert.equal(writes,0);
});

test('rejects reuse of a component in a different completed or pending adjustment',()=>{
 for(const status of ['pending','complete']){const l=structuredClone(ledger);l.partialHistoricalIncomeDedups={other:{status,candidate:{oldTransaction:{id:'other'},components:structuredClone(candidate.components)}}};assert.throws(()=>classifyPartialIncomeDedup(candidate,snapshot,l),/reserved/)}
});
test('rejects component or aggregate reserved by a different pending audit',()=>{
 for(const id of ['aggregate','component','bank:example:1']){const l=structuredClone(ledger);l.otherAudits={x:{status:'pending',candidate:{target:id}}};assert.throws(()=>classifyPartialIncomeDedup(candidate,snapshot,l),/Conflicting pending audit/)}
});

test('rejects components dated after the aggregate',()=>{const c=structuredClone(candidate),s=structuredClone(snapshot),l=structuredClone(ledger);c.components[0].transaction.date='2024-04-05';c.components[0].record.date='2024-04-05';s.transactions[1].date='2024-04-05';l.cashflows['bank:example:1'].date='2024-04-05';assert.throws(()=>classifyPartialIncomeDedup(c,s,l),/Invalid component/)});
test('failure after writing leaves pending intent and blocks a repeat',async()=>{
 const {adjustPartialIncomeDedup}=await import('./actual-partial-income-dedup.mjs');let budget=structuredClone(snapshot),state=structuredClone(ledger),writes=0;
 const deps={connect:async()=>({api:{sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,u)=>{writes++;budget.transactions.find(t=>t.id===id).amount=u.amount;throw Error('interrupted')}}}),snapshot:async()=>structuredClone(budget),backup:async()=>'/backup',json:async()=>{},readState:async()=>structuredClone(state),requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)}};
 const plan=await adjustPartialIncomeDedup(candidate,false,deps);await assert.rejects(adjustPartialIncomeDedup(candidate,true,{...deps,expectedPlan:plan.planHash}),/interrupted/);assert.equal(state.partialHistoricalIncomeDedups.aggregate.status,'pending');await assert.rejects(adjustPartialIncomeDedup(candidate,true,{...deps,expectedPlan:plan.planHash}),/Pending/);assert.equal(writes,1);
});
test('independent verification rejects an unrelated change and preserves pending intent',async()=>{
 const {adjustPartialIncomeDedup}=await import('./actual-partial-income-dedup.mjs');let budget=structuredClone(snapshot),state=structuredClone(ledger),connections=0;
 const deps={connect:async()=>{connections++;return {api:{sync:async()=>{},shutdown:async()=>{},updateTransaction:async(id,u)=>{const t=budget.transactions.find(t=>t.id===id);budget.balances.acct+=u.amount-t.amount;t.amount=u.amount}}}},snapshot:async()=>{const s=structuredClone(budget);if(connections===3)s.transactions[1].notes='unrelated change';return s},backup:async()=>'/backup',json:async()=>{},readState:async()=>structuredClone(state),requireRun:async()=>structuredClone(state),save:async x=>{state=structuredClone(x)}};
 const plan=await adjustPartialIncomeDedup(candidate,false,deps);await assert.rejects(adjustPartialIncomeDedup(candidate,true,{...deps,expectedPlan:plan.planHash}),/Unexpected transaction change/);assert.equal(state.partialHistoricalIncomeDedups.aggregate.status,'pending');
});

test('rejects absent or invalid account balance before writing',()=>{for(const n of [undefined,null,NaN,1.1]){const s=structuredClone(snapshot);s.balances.acct=n;assert.throws(()=>classifyPartialIncomeDedup(candidate,s,ledger),/balance unavailable/)}});
