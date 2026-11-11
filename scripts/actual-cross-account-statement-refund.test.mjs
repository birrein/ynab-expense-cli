import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCrossAccountStatementRefund,registerCrossAccountStatementRefund} from './actual-cross-account-statement-refund.mjs';

function fixture(){
 const original={id:'purchase',account:'card',date:'2024-08-27',amount:-1239000,payee:'merchant',category:'personal',imported_id:'gmail:purchase1',notes:'original',is_parent:false,is_child:false,transfer_id:null,reconciled:false,schedule:null};
 const record={transactionId:'purchase',currency:'CLP',account:'card',date:original.date,amount:original.amount,payee:'merchant',category:'personal',sourceIds:['purchase1'],status:'registered',verifiedAt:'verified'};
 const candidate={crossAccountStatementRefund:true,currency:'CLP',original,originalRecord:record,purchaseSourceId:'purchase1',destinationAccount:'wallet',refundDate:'2024-09-07',refundAmount:1239000,refundSource:'bank:wallet:refund:123',statementId:'statement123',merchantMessageId:'refundmsg1',paymentReference:'payment123',evidence:'Merchant confirms refund of the same payment and the destination statement confirms the credit.'};
 const snapshot={accounts:[{id:'card',closed:false,offbudget:false},{id:'wallet',closed:false,offbudget:false}],categories:[{id:'personal',hidden:false,is_income:false}],payees:[{id:'merchant',name:'Merchant'}],transactions:[original],balances:{card:-1239000,wallet:0},rules:[],schedules:[]};
 return {candidate,snapshot,ledger:{records:{purchase1:record}}};
}

test('previews one evidenced linked credit to the different destination',()=>{const {candidate,snapshot,ledger}=fixture();const a=classifyCrossAccountStatementRefund(candidate,snapshot,ledger);assert.equal(a.action,'create');assert.equal(a.account,'wallet');assert.equal(a.amount,1239000);});
test('rejects incomplete, conflicting, stale, duplicate and over-refunded cases',()=>{
 const mutations=[
  x=>x.candidate.original.category=null,
  x=>x.candidate.destinationAccount='card',
  x=>x.candidate.statementId='',
  x=>x.candidate.merchantMessageId=x.candidate.purchaseSourceId,
  x=>x.candidate.paymentReference='',
  x=>x.candidate.evidence='insufficient',
  x=>x.candidate.refundAmount=1239001,
  x=>x.candidate.refundDate='2024-08-26',
  x=>x.ledger.records.purchase1.status='pending-category',
  x=>x.ledger.records.purchase1.payee='Different merchant',
  x=>x.snapshot.transactions[0].amount=-1,
  x=>x.snapshot.accounts[1].closed=true,
  x=>x.snapshot.transactions.push({id:'credit',account:'wallet',date:'2024-09-07',amount:1239000}),
  x=>x.snapshot.transactions.push({id:'other',account:'card',date:'2024-09-06',amount:1,category:'personal',notes:'refundOf=purchase'}),
  x=>x.ledger.crossAccountStatementRefunds={'bank:wallet:refund:123':{status:'pending'}},
  x=>x.ledger.records.refundmsg1={transactionId:'elsewhere'},
  x=>x.ledger.records.other={transactionId:'elsewhere',sourceIds:['refundmsg1']},
  x=>x.ledger.cashflows={elsewhere:{sourceIds:['refundmsg1']}},
  x=>x.snapshot.transactions.push({id:'other',imported_id:'gmail:refundmsg1'}),
  x=>x.snapshot.transactions.push({id:'other',notes:'https://mail.google.com/mail/u/0/#all/refundmsg1'}),
  x=>x.snapshot.transactions.push({id:'other',notes:'source=bank:wallet:refund:123'}),
  x=>x.ledger.crossAccountStatementRefunds={'bank:other':{status:'pending',candidate:{original:{id:'purchase'}}}},
  x=>x.ledger.statementRefunds={'bank:wallet:refund:123':{status:'pending',candidate:{original:{id:'different'}}}},
 ];
 for(const mutate of mutations){const x=fixture();mutate(x);assert.throws(()=>classifyCrossAccountStatementRefund(x.candidate,x.snapshot,x.ledger));}
});
test('backs up and posts once; verifies independent state and exact retry is read-only',async()=>{
 const {candidate,snapshot,ledger}=fixture(),live=structuredClone(snapshot);let writes=0,backups=0,connects=0;
 const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{writes++;live.transactions.push({id:'refund',account,...structuredClone(rows[0]),is_parent:false,is_child:false,transfer_id:null,reconciled:false,schedule:null});live.balances[account]+=rows[0].amount;}};
 const ctx={connect:async()=>{connects++;return {api}},snapshot:async()=>structuredClone(live),backup:async()=>{backups++;return '/backup'},json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{}};
 const preview=await registerCrossAccountStatementRefund(candidate,false,ctx);assert.match(preview.planHash,/^[a-f0-9]{64}$/);ctx.expectedPlan=preview.planHash;connects=0;
 const result=await registerCrossAccountStatementRefund(candidate,true,ctx);assert.equal(result.verified,true);assert.equal(writes,1);assert.equal(backups,1);assert.equal(connects,2);assert.deepEqual(live.transactions[0],snapshot.transactions[0]);assert.equal(live.balances.wallet,1239000);assert.equal(live.balances.card,-1239000);assert.equal(ledger.records.refundmsg1.transactionId,'refund');
 const retry=await registerCrossAccountStatementRefund(candidate,true,ctx);assert.equal(retry.action,'existing');assert.equal(writes,1);assert.equal(backups,1);
 live.transactions.push({id:'duplicate',notes:'https://mail.google.com/mail/u/0/#all/refundmsg1'});await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/source/i);live.transactions.pop();
 live.transactions.push({id:'nearby',account:'wallet',date:'2024-09-08',amount:1239000});await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/nearby/i);live.transactions.pop();
 live.transactions.push({id:'extra',amount:1,category:'personal',notes:'refundOf=purchase'});await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/exceed/i);live.transactions.pop();
 ledger.statementRefunds={'bank:other':{status:'pending',candidate:{original:{id:'purchase'}}}};await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/audit/i);delete ledger.statementRefunds;
 ledger.records.refundmsg1.status='review';await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/ledger/i);assert.equal(writes,1);
});
test('interruption leaves durable pending intent and a retry performs no write',async()=>{
 const {candidate,snapshot,ledger}=fixture();let writes=0;const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async()=>{writes++;throw Error('interrupted')}};
 const ctx={connect:async()=>({api}),snapshot:async()=>structuredClone(snapshot),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{}};
 ctx.expectedPlan=(await registerCrossAccountStatementRefund(candidate,false,ctx)).planHash;
 await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/interrupted/);assert.equal(ledger.crossAccountStatementRefunds[candidate.refundSource].status,'pending');await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/pending/i);assert.equal(writes,1);
});
test('concurrent budget mutation after backup blocks posting',async()=>{
 const {candidate,snapshot,ledger}=fixture();let writes=0,mutated=false;const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async()=>{writes++}};
 const ctx={connect:async()=>({api}),snapshot:async()=>{const copy=structuredClone(snapshot);if(mutated)copy.balances.wallet=1;return copy},backup:async()=>{mutated=true;return '/backup'},json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{}};
 ctx.expectedPlan=(await registerCrossAccountStatementRefund(candidate,false,ctx)).planHash;
 await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/changed/i);assert.equal(writes,0);
});
test('commit requires a preview hash for the unchanged candidate and complete budget',async()=>{
 const {candidate,snapshot,ledger}=fixture();let writes=0;const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async()=>{writes++}};
 const ctx={connect:async()=>({api}),snapshot:async()=>structuredClone(snapshot),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{}};
 const preview=await registerCrossAccountStatementRefund(candidate,false,ctx);assert.match(preview.planHash,/^[a-f0-9]{64}$/);
 await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/preview/i);ctx.expectedPlan=preview.planHash;snapshot.balances.wallet=1;
 await assert.rejects(registerCrossAccountStatementRefund(candidate,true,ctx),/preview/i);assert.equal(writes,0);
});
function pendingFixture(){const x=fixture();x.candidate.original.category=null;x.snapshot.transactions[0].category=null;x.candidate.originalRecord.category=null;x.candidate.originalRecord.status='pending-category';x.candidate.originalRecord.reason='Purchase purpose unknown';x.ledger.records.purchase1=structuredClone(x.candidate.originalRecord);x.snapshot.categories.push({id:'unused',hidden:false,is_income:false});x.candidate.pendingCategoryReason='Purchase purpose remains unresolved';return x;}
test('previews a verified uncategorized refund with an explicit pending reason',()=>{const {candidate,snapshot,ledger}=pendingFixture();const a=classifyCrossAccountStatementRefund(candidate,snapshot,ledger);assert.equal(a.action,'create');assert.equal(a.category,null);assert.equal(a.label,'Actual/Review');assert.match(a.notes,/pendiente/i)});
test('pending refund requires consistent uncategorized purchase and explicit reason',()=>{for(const mutate of [x=>delete x.candidate.pendingCategoryReason,x=>x.candidate.pendingCategoryReason='',x=>x.candidate.originalRecord.status='registered',x=>x.candidate.originalRecord.reason='',x=>x.candidate.originalRecord.category='personal',x=>x.candidate.original.category='personal',x=>x.candidate.pendingCategoryReason='bad\nsource=other']){const x=pendingFixture();mutate(x);assert.throws(()=>classifyCrossAccountStatementRefund(x.candidate,x.snapshot,x.ledger))}});
test('categorized refunds reject a misleading pending reason',()=>{const {candidate,snapshot,ledger}=fixture();candidate.pendingCategoryReason='not pending';assert.throws(()=>classifyCrossAccountStatementRefund(candidate,snapshot,ledger))});
test('pending refund is verified uncategorized and stays in review on exact retry',async()=>{const {candidate,snapshot,ledger}=pendingFixture(),live=structuredClone(snapshot);let writes=0;const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{writes++;live.transactions.push({id:'refund',account,...structuredClone(rows[0]),is_parent:false,is_child:false,transfer_id:null,reconciled:false,schedule:null});live.balances[account]+=rows[0].amount}};const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{}};d.expectedPlan=(await registerCrossAccountStatementRefund(candidate,false,d)).planHash;const r=await registerCrossAccountStatementRefund(candidate,true,d);assert.equal(r.verified,true);assert.equal(r.label,'Actual/Review');assert.equal(live.transactions[1].category,null);assert.equal(ledger.records.refundmsg1.status,'pending-category');assert.equal(ledger.crossAccountStatementRefunds[candidate.refundSource].status,'registered-pending-category');const retry=await registerCrossAccountStatementRefund(candidate,true,d);assert.equal(retry.action,'existing');assert.equal(retry.label,'Actual/Review');assert.equal(writes,1)});
test('pending refund refuses another pending refund of the same purchase',()=>{const {candidate,snapshot,ledger}=pendingFixture();ledger.crossAccountStatementRefunds={'bank:other':{status:'registered-pending-category',id:'other',candidate:{original:{id:'purchase'}}}};assert.throws(()=>classifyCrossAccountStatementRefund(candidate,snapshot,ledger),/refund|pending/i)});
test('pending refund requires every grouped purchase source to resolve to the same ledger record',()=>{const {candidate,snapshot,ledger}=pendingFixture();candidate.originalRecord.sourceIds.push('purchase2');ledger.records.purchase1=structuredClone(candidate.originalRecord);assert.throws(()=>classifyCrossAccountStatementRefund(candidate,snapshot,ledger),/ledger/i);ledger.records.purchase2={transactionId:'other'};assert.throws(()=>classifyCrossAccountStatementRefund(candidate,snapshot,ledger),/ledger/i);ledger.records.purchase2=structuredClone(candidate.originalRecord);assert.equal(classifyCrossAccountStatementRefund(candidate,snapshot,ledger).action,'create');candidate.originalRecord.sourceIds.push('purchase2');ledger.records.purchase1=structuredClone(candidate.originalRecord);ledger.records.purchase2=structuredClone(candidate.originalRecord);assert.throws(()=>classifyCrossAccountStatementRefund(candidate,snapshot,ledger),/source/i)});
test('pending refund rejects unlisted aliases owning the same purchase',()=>{const {candidate,snapshot,ledger}=pendingFixture();ledger.records.extra={...structuredClone(candidate.originalRecord),sourceIds:['extra']};assert.throws(()=>classifyCrossAccountStatementRefund(candidate,snapshot,ledger),/alias|source/i)});
