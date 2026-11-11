import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyDatedSplitRefund,registerDatedSplitRefund} from './actual-dated-split-refund.mjs';

function fixture(){
 const p={datedSplitPurchaseRefund:true,currency:'CLP',account:'card',payee:'store',purchaseDate:'2025-10-02',refundDate:'2025-10-03',purchaseAmount:-3831500,refundAmount:150300,purchaseSources:['1111111111111111','2222222222222222'],refundSources:['3333333333333333'],statementId:'statement123',orderId:'order12345',allocations:[{category:'food',net:2904200,refund:118600},{category:'care',net:777000,refund:31700}],evidence:'Verified complete receipt, initial charge and next-day refund; global discount allocated proportionally as an accounting estimate.'};
 const s={accounts:[{id:'card',closed:false,offbudget:false}],payees:[{id:'store',name:'Santa Isabel'}],categories:[{id:'food',hidden:false,is_income:false},{id:'care',hidden:false,is_income:false}],transactions:[],balances:{card:0},rules:[],schedules:[]};
 return {p,s,l:{records:{},cashflows:{}}};
}
test('previews charge and credit with exact receipt-backed category nets',()=>{const {p,s,l}=fixture();const r=classifyDatedSplitRefund(p,s,l);assert.equal(r.action,'create');assert.deepEqual(r.purchaseSplits.map(x=>x.amount),[-3022800,-808700]);assert.deepEqual(r.refundSplits.map(x=>x.amount),[118600,31700]);});
test('preserves separate food, personal care and alcohol categories for a global discount',()=>{const {p,s,l}=fixture();s.categories.push({id:'alcohol',hidden:false,is_income:false});p.allocations=[{category:'food',net:2904200,refund:118600},{category:'care',net:378000,refund:15400},{category:'alcohol',net:399000,refund:16300}];const r=classifyDatedSplitRefund(p,s,l);assert.deepEqual(r.purchaseSplits.map(x=>x.amount),[-3022800,-393400,-415300]);assert.deepEqual(r.refundSplits.map(x=>x.amount),[118600,15400,16300]);});
test('rejects unequal totals, unreasonable proportional allocation, reused sources and nearby possible duplicates',()=>{
 const mutations=[x=>x.p.purchaseAmount--,x=>x.p.refundAmount--,x=>x.p.allocations[0].refund+=100,x=>x.p.allocations[0].refund--,x=>x.p.allocations[1].category='food',x=>x.p.refundSources=x.p.purchaseSources,x=>x.p.refundDate='2025-10-01',x=>x.p.statementId='',x=>x.l.records['1111111111111111']={transactionId:'existing'},x=>x.s.transactions.push({id:'existing',account:'card',date:'2025-10-02',amount:-3831500}),x=>x.s.transactions.push({id:'existing',account:'card',date:'2025-10-03',amount:150300}),x=>x.l.datedSplitRefunds={'1111111111111111':{status:'pending'}}];
 for(const [i,mutate] of mutations.entries()){const x=fixture();mutate(x);assert.throws(()=>classifyDatedSplitRefund(x.p,x.s,x.l),`mutation ${i}`);}
});
test('creates two splits once, links them, independently verifies and audits sources',async()=>{
 const {p,s,l}=fixture();const live=structuredClone(s);let writes=0,saves=0,backups=0;
 const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{for(const row of rows){const id=++writes===1?'purchase':'refund';const subtransactions=row.subtransactions.map((c,i)=>({id:id+i,is_child:true,is_parent:false,parent_id:id,account,date:row.date,...c}));live.transactions.push({id,account,...row,is_child:false,transfer_id:null,reconciled:false,schedule:null,subtransactions});live.balances[account]+=row.amount;}},getTransactions:async(account,start,end)=>live.transactions.filter(t=>t.account===account&&t.date>=start&&t.date<=end)};
 const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),backup:async()=>{backups++;return '/backup'},json:async()=>{},requireRun:async()=>l,readState:async()=>l,save:async()=>{saves++}};
 const a=await registerDatedSplitRefund(p,true,d);assert.equal(a.verified,true);assert.equal(writes,2);assert.equal(backups,1);assert.ok(saves>=2);assert.equal(l.records[p.purchaseSources[0]].transactionId,'purchase');assert.equal(l.records[p.refundSources[0]].refundOf,'purchase');assert.equal(live.balances.card,-3681200);const b=await registerDatedSplitRefund(p,true,d);assert.equal(b.action,'existing');assert.equal(writes,2);
});
test('an interrupted second leg blocks retry without another write',async()=>{
 const {p,s,l}=fixture();let writes=0;const live=structuredClone(s);const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{if(++writes===2)throw Error('interrupted');const row=rows[0],id='purchase';live.transactions.push({id,account,...row,is_child:false,transfer_id:null,reconciled:false,schedule:null,subtransactions:row.subtransactions.map((c,i)=>({id:id+i,is_child:true,parent_id:id,account,date:row.date,...c}))});},getTransactions:async()=>live.transactions};
 const d={connect:async()=>({api}),snapshot:async()=>structuredClone(live),backup:async()=>'/backup',json:async()=>{},requireRun:async()=>l,readState:async()=>l,save:async()=>{}};
 await assert.rejects(registerDatedSplitRefund(p,true,d),/interrupted/);assert.equal(l.datedSplitRefunds[p.purchaseSources[0]].status,'pending');await assert.rejects(registerDatedSplitRefund(p,true,d),/pending/i);assert.equal(writes,2);
});
