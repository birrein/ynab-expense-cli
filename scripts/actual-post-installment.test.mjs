import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPosting } from './actual-post-installment.mjs';
const candidate={currency:'CLP',account:'acc',scheduleId:'s1',ruleId:'r1',payee:'p1',date:'2026-10-23',amount:-10000,billedAmount:-10000,category:'cat',sourceId:'statement:oct:ref1',statementMessageId:'abc',evidence:'Bank statement line 1'};
const snapshot=()=>({accounts:[{id:'acc',closed:false,offbudget:false}],categories:[{id:'cat',hidden:false}],transactions:[],schedules:[{id:'s1',rule:'r1',account:'acc',payee:'p1',date:'2026-10-23',next_date:'2026-10-23',amount:-10000,completed:false,posts_transaction:false}],rules:[{id:'r1',actions:[{op:'set',field:'category',value:'cat'},{op:'link-schedule',value:'s1'}]}]});
test('previews a uniquely verified schedule',()=>assert.equal(classifyPosting(candidate,snapshot()).action,'create'));
test('rejects a billed and scheduled amount mismatch',()=>assert.equal(classifyPosting({...candidate,billedAmount:-9900},snapshot()).action,'review'));
test('rejects an unrelated same-amount transaction near the date',()=>{const s=snapshot();s.transactions.push({id:'other',account:'acc',date:'2026-10-23',amount:-10000});assert.equal(classifyPosting(candidate,s).action,'review')});
test('recovers the same already linked installment',()=>{const s=snapshot();s.transactions.push({id:'t1',account:'acc',payee:'p1',date:'2026-10-23',amount:-10000,category:'cat',schedule:'s1',imported_id:'statement:oct:ref1',notes:'Fuente cartola: https://mail.google.com/mail/u/0/#all/abc\nReferencia: statement:oct:ref1'});assert.equal(classifyPosting(candidate,s).action,'existing')});
test('rejects any other linked installment transaction',()=>{const s=snapshot();s.transactions.push({id:'t2',schedule:'s1',amount:-1});assert.equal(classifyPosting(candidate,s).action,'review')});

test('commit links a single transaction and preserves unrelated data on retry',async()=>{
 const {postInstallment}=await import('./actual-post-installment.mjs');
 const state=snapshot();state.balances={acc:100000};state.transactions.push({id:'unrelated',account:'acc',date:'2026-09-01',amount:-2000});let ledger={},writes=0;
 const api={shutdown:async()=>{},sync:async()=>{},addTransactions:async(account,arr)=>{writes++;state.transactions.push({id:'t1',account,...arr[0]});state.balances.acc+=arr[0].amount},getTransactions:async()=>state.transactions,updateTransaction:async(id,fields)=>Object.assign(state.transactions.find(t=>t.id===id),fields)};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>'/backup',requireRun:async()=>ledger,save:async()=>{},json:async()=>{},equal:(a,b)=>assert.deepEqual(a,b)};
 const first=await postInstallment(candidate,true,ctx);assert.equal(first.verified,true);assert.equal(state.transactions.find(t=>t.id==='t1').schedule,'s1');assert.equal(state.balances.acc,90000);
 const retry=await postInstallment(candidate,true,ctx);assert.equal(retry.verified,true);assert.equal(writes,1);assert.equal(state.transactions.length,2);assert.equal(ledger.installmentPostings[candidate.sourceId].transactionId,'t1');
});

test('a failed link is recovered without posting a second charge',async()=>{
 const {postInstallment}=await import('./actual-post-installment.mjs');const state=snapshot();state.balances={acc:100000};let fail=true,writes=0,ledger={};
 const api={shutdown:async()=>{},sync:async()=>{},addTransactions:async(account,arr)=>{writes++;state.transactions.push({id:'t1',account,...arr[0]});state.balances.acc+=arr[0].amount},getTransactions:async()=>state.transactions,updateTransaction:async(id,fields)=>{if(fail){fail=false;throw Error('link failed')}Object.assign(state.transactions.find(t=>t.id===id),fields)}};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>'/backup',requireRun:async()=>ledger,save:async()=>{},json:async()=>{},equal:(a,b)=>assert.deepEqual(a,b)};
 await assert.rejects(postInstallment(candidate,true,ctx),/link failed/);const result=await postInstallment(candidate,true,ctx);assert.equal(result.verified,true);assert.equal(writes,1);assert.equal(state.transactions[0].schedule,'s1');
});

test('verified posting accepts automatic completion of the target schedule and reordering',async()=>{
 const {postInstallment}=await import('./actual-post-installment.mjs');const state=snapshot();state.balances={acc:100000};state.schedules.push({id:'s2',completed:false});let ledger={};
 const api={shutdown:async()=>{},sync:async()=>{state.schedules.find(s=>s.id==='s1').completed=true;state.schedules.reverse()},addTransactions:async(account,arr)=>{state.transactions.push({id:'t1',account,...arr[0]});state.balances.acc+=arr[0].amount},getTransactions:async()=>state.transactions,updateTransaction:async(id,fields)=>Object.assign(state.transactions.find(t=>t.id===id),fields)};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>'/backup',requireRun:async()=>ledger,save:async()=>{},json:async()=>{},equal:(a,b)=>assert.deepEqual(a,b)};
 const result=await postInstallment(candidate,true,ctx);assert.equal(result.verified,true);assert.equal(state.schedules.find(s=>s.id==='s1').completed,true);
});
test('rejects an installment candidate mixed with other operation flags',()=>assert.equal(classifyPosting({...candidate,transactionNotesAmendment:true},snapshot()).action,'review'));
