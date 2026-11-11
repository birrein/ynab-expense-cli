import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyStatementRefund, registerStatementRefund} from './actual-statement-refund.mjs';

function fixture(){
 const original={id:'purchase',account:'card',date:'2024-11-01',amount:-140000,payee:'whoosh',category:'transport',imported_id:'bank:purchase',notes:'Whoosh',is_parent:false,is_child:false,transfer_id:null,reconciled:false,schedule:null};
 const record={type:'expense',id:'purchase',currency:'CLP',account:'card',date:original.date,amount:original.amount,category:'transport',status:'registered',verifiedAt:'verified'};
 const candidate={statementRefund:true,currency:'CLP',original,originalRecord:record,refundDate:'2024-11-02',refundAmount:40000,refundSource:'bank:refund',statementId:'statement123',evidence:'Statement shows the original charge and the subsequent partial refund.'};
 const snapshot={accounts:[{id:'card',closed:false,offbudget:false}],categories:[{id:'transport',hidden:false,is_income:false}],payees:[{id:'whoosh',name:'Whoosh'}],transactions:[original],balances:{card:-140000},rules:[],schedules:[]};
 const ledger={cashflows:{'bank:purchase':record}};
 return {candidate,snapshot,ledger};
}
test('previews a statement-backed linked refund',()=>{const {candidate,snapshot,ledger}=fixture();const result=classifyStatementRefund(candidate,snapshot,ledger);assert.equal(result.action,'create');assert.equal(result.amount,40000);});
test('rejects unverified, stale, duplicate, over-refunded or interrupted candidates',()=>{
 const mutations=[
  ({candidate})=>candidate.evidence='',
  ({candidate})=>candidate.statementId='',
  ({candidate})=>candidate.refundAmount=140001,
  ({candidate})=>candidate.refundDate='2024-10-31',
  ({ledger})=>ledger.cashflows['bank:purchase'].status='review',
  ({snapshot})=>snapshot.transactions[0].amount=-1,
  ({snapshot})=>snapshot.transactions.push({id:'other',account:'card',date:'2024-11-02',amount:40000}),
  ({ledger})=>ledger.statementRefunds={'bank:refund':{status:'pending'}},
  ({snapshot})=>snapshot.transactions.push({id:'prior',amount:110000,notes:'refundOf=purchase'}),
 ];
 for(const mutate of mutations){const x=fixture();mutate(x);assert.throws(()=>classifyStatementRefund(x.candidate,x.snapshot,x.ledger));}
});
test('writes once, verifies independently, and makes the exact retry read-only',async()=>{
 const {candidate,snapshot,ledger}=fixture();const live=structuredClone(snapshot);let writes=0,backups=0,saves=0;
 const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{writes++;live.transactions.push({id:'refund',account,...structuredClone(rows[0]),is_parent:false,is_child:false,transfer_id:null,reconciled:false,schedule:null});live.balances[account]+=rows[0].amount;}};
 const ctx={connect:async()=>({api}),snapshot:async()=>structuredClone(live),backup:async()=>{backups++;return '/backup'},json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{saves++;}};
 const result=await registerStatementRefund(candidate,true,ctx);assert.equal(result.verified,true);assert.equal(writes,1);assert.equal(backups,1);assert.ok(saves>=2);assert.deepEqual(live.transactions[0],snapshot.transactions[0]);
 const again=await registerStatementRefund(candidate,true,ctx);assert.equal(again.action,'existing');assert.equal(writes,1);assert.equal(backups,1);
});
test('interrupted write leaves a durable intent and blocks a second write',async()=>{
 const {candidate,snapshot,ledger}=fixture();let writes=0;const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async()=>{writes++;throw Error('interrupted')}};
 const ctx={connect:async()=>({api}),snapshot:async()=>structuredClone(snapshot),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{}};
 await assert.rejects(registerStatementRefund(candidate,true,ctx),/interrupted/);assert.equal(ledger.statementRefunds[candidate.refundSource].status,'pending');await assert.rejects(registerStatementRefund(candidate,true,ctx),/pending/i);assert.equal(writes,1);
});
